<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import type { CSSProperties } from 'vue'
import { useToast } from 'vue-toastification'

import { useBewlyApp } from '~/composables/useAppProvider'
import { useVideoCardState } from '~/composables/useVideoCardState'
import { accessKey, settings } from '~/logic'
import { useMainStore } from '~/stores/mainStore'
import api from '~/utils/api'
import { getTvSign, TVAppKey } from '~/utils/authProvider'
import { calcCurrentTime, calcTimeSince, numFormatter } from '~/utils/dataFormatter'
import { getCSRF, removeHttpFromUrl } from '~/utils/main'

import Tooltip from '../Tooltip.vue'
import { getPreviewSources } from './preview'
import type { Video } from './types'
import { getCurrentTime, getCurrentVideoUrl } from './utils'
import VideoCardAuthorAvatar from './VideoCardAuthor/components/VideoCardAuthorAvatar.vue'
import VideoCardAuthorName from './VideoCardAuthor/components/VideoCardAuthorName.vue'
import VideoCardContextMenu from './VideoCardContextMenu/VideoCardContextMenu.vue'
import VideoCardSkeleton from './VideoCardSkeleton.vue'
import VideoRemovedCover from './VideoRemovedCover.vue'

const props = withDefaults(defineProps<Props>(), {
  showWatcherLater: true,
  type: 'common',
  moreBtn: true,
  coverLoading: 'lazy',
})

interface Props {
  coverLoading?: 'eager' | 'lazy'
  skeleton?: boolean
  video?: Video
  reserveTitleSpace?: boolean
  /** rcmd: recommend video; appRcmd: app recommend video; bangumi: bangumi video; common: common video */
  type?: 'rcmd' | 'appRcmd' | 'bangumi' | 'common'
  showWatcherLater?: boolean
  horizontal?: boolean
  showPreview?: boolean
  moreBtn?: boolean
  uploaderBlock?: boolean
}

const toast = useToast()
const { mainAppRef, openIframeDrawer } = useBewlyApp()
const { setActivatedCover } = useMainStore()

const showVideoOptions = ref<boolean>(false)
const videoOptionsFloatingStyles = ref<CSSProperties>({})
// Whether the user has marked it as disliked
const cardState = useVideoCardState(() => props.video)
const removed = computed({
  get: () => cardState.value.removed,
  set: value => (cardState.value.removed = value),
})

const moreBtnRef = ref<HTMLDivElement | null>(null)

const selectedDislikeOpt = computed({
  get: () => cardState.value.selectedDislikeOpt,
  set: value => (cardState.value.selectedDislikeOpt = value),
})

const videoCurrentTime = ref<number | null>(null)

const videoUrl = computed(() => {
  if (removed.value || !props.video)
    return undefined

  if (props.video.url)
    return props.video.url
  else if (props.video.bvid || props.video.aid)
    return getCurrentVideoUrl(props.video, videoCurrentTime)
  else if (props.video.epid)
    return `https://www.bilibili.com/bangumi/play/ep${props.video.epid}`
  else if (props.video.roomid)
    return `https://live.bilibili.com/${props.video.roomid}`
  else return ''
})

const isInWatchLater = computed({
  get: () => cardState.value.isInWatchLater,
  set: value => (cardState.value.isInWatchLater = value),
})
const isHover = ref<boolean>(false)
let mouseEnterTimeout: ReturnType<typeof setTimeout> | undefined
const previewVideoUrl = ref('')
const previewReady = ref(false)
const retriedPreview = ref(false)
let previewBackups: string[] = []
const contentVisibility = ref<'auto' | 'visible'>('auto')
const videoElement = ref<HTMLVideoElement | null>(null)
const previewEnabled = computed(() => props.showPreview && settings.value.enableVideoPreview)
const showPreviewControls = computed(() => previewReady.value && isHover.value && settings.value.enableVideoCtrlBarOnVideoCard)
const danmakuCount = computed(() => numFormatter(props.video?.danmaku || props.video?.danmakuStr || 0).trim())

watch(
  [isHover, previewEnabled, removed, retriedPreview],
  async (_, __, onCleanup) => {
    previewReady.value = false
    const video = props.video
    if (
      !video
      || !isHover.value
      || !previewEnabled.value
      || removed.value
      || previewVideoUrl.value
      || !(video.aid || video.bvid)
    ) {
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    try {
      const [url, ...backups] = await getPreviewSources(video, controller.signal)
      if (!controller.signal.aborted && isHover.value && previewEnabled.value && !removed.value) {
        previewVideoUrl.value = url
        previewBackups = backups
      }
    }
    catch {
      // Preview is optional; a later hover can retry a failed or timed-out request.
    }
  },
)
watch(
  [() => props.video?.bvid, () => props.video?.aid, () => props.video?.id, () => props.video?.cid],
  () => {
    previewVideoUrl.value = ''
    previewBackups = []
    videoCurrentTime.value = null
    stopPreview()
  },
  { flush: 'sync' },
)

function stopPreview() {
  clearTimeout(mouseEnterTimeout)
  contentVisibility.value = 'auto'
  isHover.value = false
  previewReady.value = false
  retriedPreview.value = false
  videoElement.value?.pause()
}
onDeactivated(stopPreview)
onBeforeUnmount(stopPreview)

function isCurrentPreview(event: Event) {
  const player = videoElement.value
  return isHover.value && previewEnabled.value && !removed.value
    && player && event.currentTarget === player && player.getAttribute('src') === previewVideoUrl.value
}

function showPreviewFrame(event: Event) {
  if (isCurrentPreview(event))
    previewReady.value = true
}

function handlePreviewError(event: Event) {
  if (!isCurrentPreview(event))
    return
  previewReady.value = false
  previewVideoUrl.value = previewBackups.shift() ?? ''
  if (!previewVideoUrl.value && !retriedPreview.value)
    retriedPreview.value = true
}

function toggleWatchLater() {
  if (!props.video)
    return
  const state = cardState.value

  if (!isInWatchLater.value) {
    api.watchlater
      .saveToWatchLater({
        aid: props.video.id,
        csrf: getCSRF(),
      })
      .then((res) => {
        if (res.code === 0)
          state.isInWatchLater = true
        else toast.error(res.message)
      })
  }
  else {
    api.watchlater
      .removeFromWatchLater({
        aid: props.video.id,
        csrf: getCSRF(),
      })
      .then((res) => {
        if (res.code === 0)
          state.isInWatchLater = false
        else toast.error(res.message)
      })
  }
}

function handleMouseEnter() {
  clearTimeout(mouseEnterTimeout)
  props.video && setActivatedCover(`${removeHttpFromUrl(props.video.cover)}@672w_378h_1c_!web-home-common-cover`)

  // fix #789
  contentVisibility.value = 'visible'
  mouseEnterTimeout = setTimeout(
    () => {
      isHover.value = true
    },
    settings.value.hoverVideoCardDelayed ? 1200 : 500,
  )
}

function handleClick(event: MouseEvent) {
  videoCurrentTime.value = getCurrentTime(videoElement)

  if (settings.value.videoCardLinkOpenMode === 'drawer' && videoUrl.value && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    openIframeDrawer(videoUrl.value)
  }
}

function handleMoreBtnClick(event: MouseEvent) {
  // the distance between the bottom and the height of the more button
  if (!moreBtnRef.value)
    return
  const { bottom, height } = moreBtnRef.value.getBoundingClientRect()

  /**
   * if (screen height - bottom > 406px) then context-menu offset upwards
   * Why 406? Because the current context-menu is not a responsive layout, it can be temporarily referred to as 406
   */
  const offsetTop = window.innerHeight - bottom > 406 ? 0 : -406 - height

  showVideoOptions.value = false
  videoOptionsFloatingStyles.value = {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translate(${event.x}px, ${event.y + offsetTop}px)`,
  }
  showVideoOptions.value = true
}

function handleUndo() {
  const state = cardState.value
  if (props.type === 'appRcmd') {
    const params = {
      access_key: accessKey.value,
      goto: props.video?.goto,
      id: props.video?.id,
      // https://github.com/magicdawn/bilibili-app-recommend/blob/cb51f75f415f48235ce048537f2013122c16b56b/src/components/VideoCard/card.service.ts#L115
      idx: Number((Date.now() / 1000).toFixed(0)),
      reason_id: selectedDislikeOpt.value?.dislikeReasonId, // 1 means dislike, e.g. {"id": 1, "name": "不感兴趣","toast": "将减少相似内容推荐"}
      build: 74800100,
      device: 'pad',
      mobi_app: 'iphone',
      appkey: TVAppKey.appkey,
    }

    api.video
      .undoDislikeVideo({
        ...params,
        sign: getTvSign(params),
      })
      .then((res) => {
        if (res.code === 0) {
          state.removed = false
        }
        else {
          toast.error(res.message)
        }
      })
  }
  else {
    state.removed = false
  }
}

function handleRemoved(selectedOpt?: { dislikeReasonId: number }) {
  selectedDislikeOpt.value = selectedOpt
  removed.value = true
}

provide('getVideoType', () => props.type!)
</script>

<template>
  <div
    :style="{ contentVisibility }"
    intrinsic-size-300px
    duration-300
    ease-in-out
    rounded="$bew-radius"
    ring="hover:8 hover:$bew-fill-2 active:8 active:$bew-fill-3"
    bg="hover:$bew-fill-2 active:$bew-fill-3"
    transform="~ translate-z-0"
    mb-4
  >
    <div v-if="!skeleton && video">
      <div class="video-card group" w="full" rounded="$bew-radius">
        <ALink
          :style="{ display: horizontal ? 'flex' : 'block', gap: horizontal ? '1.5rem' : '0' }"
          :href="videoUrl"
          type="videoCard"
          :custom-click-event="settings.videoCardLinkOpenMode === 'drawer'"
          @mouseenter="handleMouseEnter"
          @mouseleave="stopPreview"
          @click="handleClick"
        >
          <!-- Cover -->
          <div
            class="group/cover"
            :class="horizontal ? 'horizontal-card-cover' : 'vertical-card-cover'"
            shrink-0
            h-fit
            relative
            bg="$bew-skeleton"
            rounded="$bew-radius"
            cursor-pointer
            group-hover:z-2
            transform="~ translate-z-0"
          >
            <!-- Video cover -->
            <Picture
              :src="`${removeHttpFromUrl(video.cover)}@672w_378h_1c_!web-home-common-cover`"
              :loading="coverLoading"
              w="full"
              max-w-full
              align-middle
              aspect-video
              object-cover
              rounded="$bew-radius"
            />

            <VideoRemovedCover v-if="removed" @undo="handleUndo" />

            <!-- Video preview -->
            <Transition v-if="!removed && previewEnabled" name="fade">
              <video
                v-if="previewVideoUrl && isHover"
                ref="videoElement"
                :key="previewVideoUrl"
                :src="previewVideoUrl"
                autoplay
                loop
                muted
                playsinline
                :controls="settings.enableVideoCtrlBarOnVideoCard"
                :class="{ 'opacity-0': !previewReady }"
                :style="{ pointerEvents: showPreviewControls ? 'auto' : 'none' }"
                pos="absolute top-0 left-0"
                w-full
                aspect-video
                rounded="$bew-radius"
                bg-black
                @loadeddata="showPreviewFrame"
                @playing="showPreviewFrame"
                @error="handlePreviewError"
              />
            </Transition>

            <!-- Ranking Number -->
            <div v-if="video.rank" pos="absolute top-0" p-2 group-hover:opacity-0 duration-300>
              <div
                v-if="Number(video.rank) <= 3"
                bg="$bew-theme-color"
                text-center
                lh-0
                h-30px
                w-30px
                text-white
                rounded="1/2"
                shadow="$bew-shadow-1"
                border="1 $bew-theme-color"
                grid="~ place-content-center"
                text="xl"
                fw-bold
              >
                {{ video.rank }}
              </div>
              <div
                v-else
                bg="$bew-elevated-solid"
                text-center
                lh-30px
                h-30px
                w-30px
                rounded="1/2"
                shadow="$bew-shadow-1"
                border="1 $bew-border-color"
              >
                {{ video.rank }}
              </div>
            </div>

            <template v-if="!removed">
              <div
                class="video-card-cover-footer"
                :class="{ 'video-card-cover-footer--above-controls': showPreviewControls }"
              >
                <div v-if="video.view || video.viewStr || video.danmaku || video.danmakuStr" class="video-card-stats">
                  <span v-if="video.view || video.viewStr">
                    <i i-tabler:player-play aria-hidden="true" />
                    {{
                      video.view
                        ? $t('common.view', { count: numFormatter(video.view) }, video.view)
                        : `${numFormatter(video.viewStr || '0')}${$t('common.viewWithoutNum')}`
                    }}
                  </span>
                  <span
                    v-if="video.danmaku || video.danmakuStr"
                    role="img"
                    :aria-label="video.danmaku
                      ? $t('common.danmaku', { count: danmakuCount }, video.danmaku)
                      : `${danmakuCount}${$t('common.danmakuWithoutNum')}`"
                  >
                    <i i-tabler:message-dots aria-hidden="true" />
                    {{ danmakuCount }}
                  </span>
                </div>
                <div
                  v-if="video.duration || video.durationStr"
                  class="group-hover:opacity-0"
                  m-s-auto shrink-0 p="x-2 y-1" rounded="$bew-radius"
                  text="!white xs" bg="black opacity-60" duration-300
                >
                  {{ video.duration ? calcCurrentTime(video.duration) : video.durationStr }}
                </div>
              </div>

              <div
                class="opacity-0 group-hover/cover:opacity-100"
                transform="scale-70 group-hover/cover:scale-100"
                duration-300
                pos="absolute top-0 left-0"
                z-2
                @click.stop=""
              >
                <slot name="coverTopLeft" />
              </div>

              <div
                v-if="video.liveStatus === 1"
                class="group-hover:opacity-0"
                pos="absolute left-0 top-0"
                bg="$bew-theme-color"
                text="xs white"
                fw-bold
                p="x-2 y-1"
                m-1
                inline-block
                rounded="$bew-radius"
                duration-300
              >
                LIVE
                <i i-svg-spinners:pulse-3 align-middle mt--0.2em />
              </div>

              <div
                v-if="video.badge && Object.keys(video.badge).length > 0"
                class="group-hover:opacity-0"
                :style="{
                  backgroundColor: video.badge.bgColor,
                  color: video.badge.color,
                }"
                pos="absolute right-0 top-0"
                bg="$bew-theme-color"
                text="xs white"
                p="x-2 y-1"
                m-1
                inline-block
                rounded="$bew-radius"
                duration-300
              >
                {{ video.badge.text }}
              </div>

              <!-- Watcher later button -->
              <button
                v-if="showWatcherLater"
                pos="absolute top-0 right-0"
                z="2"
                p="x-2 y-1"
                m="1"
                rounded="$bew-radius"
                text="!white xl"
                bg="black opacity-60"
                class="opacity-0 group-hover/cover:opacity-100"
                transform="scale-70 group-hover/cover:scale-100"
                duration-300
                @click.prevent.stop="toggleWatchLater"
              >
                <Tooltip
                  v-if="!isInWatchLater"
                  :content="$t('common.save_to_watch_later')"
                  placement="bottom-right"
                  type="dark"
                >
                  <div i-mingcute:carplay-line />
                </Tooltip>
                <Tooltip v-else :content="$t('common.added')" placement="bottom-right" type="dark">
                  <Icon icon="line-md:confirm" />
                </Tooltip>
              </button>
            </template>
          </div>

          <!-- Other Information -->
          <div
            v-if="!removed"
            :style="{
              width: horizontal ? '100%' : 'unset',
              marginTop: horizontal ? '0' : '1rem',
            }"
            flex="~"
          >
            <!-- Author Avatar -->
            <VideoCardAuthorAvatar
              v-if="!horizontal && video.author"
              :author="video.author"
              :is-live="video.liveStatus === 1"
            />
            <div class="group/desc" flex="~ col" w="full" align="items-start">
              <div flex="~ gap-1 justify-between items-start" w="full" pos="relative">
                <h3
                  class="keep-two-lines"
                  :class="{ 'fixed-title-height': reserveTitleSpace }"
                  text="overflow-ellipsis $bew-text-1 lg"
                  cursor="pointer"
                >
                  <a :href="videoUrl" target="_blank" :title="video.title">
                    {{ video.title }}
                  </a>
                </h3>

                <div
                  v-if="moreBtn"
                  ref="moreBtnRef"
                  :class="{ 'more-active': showVideoOptions }"
                  bg="hover:$bew-fill-2 active:$bew-fill-3"
                  shrink-0
                  w-32px
                  h-32px
                  m="t--3px r--4px"
                  grid
                  place-items-center
                  cursor-pointer
                  rounded="50%"
                  duration-300
                  @click.stop.prevent="handleMoreBtnClick"
                >
                  <div i-mingcute:more-2-line text="lg" />
                </div>
              </div>
              <div text="sm $bew-text-2" w-fit m="t-2" flex="~ items-center wrap">
                <!-- Author Avatar -->
                <span
                  :style="{
                    marginBottom: horizontal ? '0.5rem' : '0',
                  }"
                  flex="inline items-center"
                >
                  <VideoCardAuthorAvatar
                    v-if="horizontal && video.author"
                    :author="video.author"
                    :is-live="video.liveStatus === 1"
                  />
                  <VideoCardAuthorName :author="video.author" />
                </span>
              </div>

              <div mt-2 flex="~ gap-1 wrap" text="sm">
                <!-- Tag -->
                <span
                  v-if="video.tag"
                  text="$bew-theme-color"
                  lh-6
                  p="x-2"
                  rounded="$bew-radius"
                  bg="$bew-theme-color-20"
                >
                  {{ video.tag }}
                </span>
                <span
                  v-if="video.publishedTimestamp || video.capsuleText"
                  bg="$bew-fill-1"
                  p="x-2"
                  rounded="$bew-radius"
                  text="$bew-text-3"
                  lh-6
                  mr-1
                >
                  {{
                    video.publishedTimestamp
                      ? calcTimeSince(video.publishedTimestamp * 1000)
                      : video.capsuleText?.trim()
                  }}
                </span>
                <!-- Video type -->
                <span text="$bew-text-2" grid="~ place-items-center">
                  <div v-if="video.type === 'vertical'" i-mingcute:cellphone-2-line />
                  <div v-else-if="video.type === 'bangumi'" i-mingcute:movie-line />
                </span>
              </div>
            </div>
          </div>
        </ALink>
      </div>
    </div>

    <!-- skeleton -->
    <VideoCardSkeleton v-if="skeleton" :horizontal="horizontal" important-mb-0 />

    <!-- context menu -->
    <Teleport v-if="showVideoOptions && video" :to="mainAppRef">
      <VideoCardContextMenu
        :video="{
          ...video,
          url: videoUrl,
        }"
        :context-menu-styles="videoOptionsFloatingStyles"
        :uploader-block="uploaderBlock"
        @close="showVideoOptions = false"
        @removed="handleRemoved"
      />
      <!-- @reopen="handleMoreBtnClick" -->
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.horizontal-card-cover {
  --uno: "xl:w-280px lg:w-250px md:w-200px w-200px";
}

.vertical-card-cover {
  --uno: "w-full";
}

.video-card-cover-footer {
  position: absolute;
  z-index: 2;
  inset-inline: 4px;
  inset-block-end: 4px;
  display: flex;
  gap: 4px;
  align-items: flex-end;
  pointer-events: none;
}

.video-card-cover-footer--above-controls {
  inset-block-end: 3rem;
}

.video-card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 8px;
  padding: 4px 7px;
  border-radius: var(--bew-radius);
  background: rgb(0 0 0 / 72%);
  color: white;
  font-size: 0.75rem;
  line-height: 1rem;
  font-variant-numeric: tabular-nums;
  visibility: hidden;
  opacity: 0;
  transition:
    opacity 120ms ease,
    visibility 0s linear 120ms;

  > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
}

.video-card:has(:focus-visible) .video-card-stats {
  visibility: visible;
  opacity: 1;
  transition-delay: 0s;
}

@media (hover: hover) {
  .video-card:hover .video-card-stats {
    visibility: visible;
    opacity: 1;
    transition-delay: 0s;
  }
}

@media (prefers-reduced-motion: reduce) {
  .video-card-stats {
    transition: none;
  }
}

.more-active {
  --uno: "opacity-100";
}
</style>
