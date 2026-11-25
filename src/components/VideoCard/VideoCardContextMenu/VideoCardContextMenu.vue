<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBewlyApp } from '~/composables/useAppProvider'
import { useBlockUploader } from '~/composables/useBlockUploader'
import { Type as ThreePointV2Type } from '~/models/video/appForYou'
import { normalizeUploaderMid } from '~/utils/blockedUploaders'
import { openLinkToNewTab } from '~/utils/main'
import { openLinkInBackground } from '~/utils/tabs'

import type { Video } from '../types'
import DislikeDialog from './components/DislikeDialog.vue'

const props = defineProps<{
  video: Video
  contextMenuStyles: CSSProperties
  uploaderBlock?: boolean
}>()
const emit = defineEmits<{
  (event: 'removed', selectedOpt?: { dislikeReasonId: number }): void
  (event: 'close'): void
  (event: 'reopen'): void
}>()

const getVideoType = inject<() => string>('getVideoType')!
const showLocalActions = computed(() => getVideoType() === 'rcmd' || (getVideoType() === 'common' && !!props.video.bvid))
const uploader = computed(() => {
  const author = props.video.author
  if (props.uploaderBlock && !Array.isArray(author) && normalizeUploaderMid(author?.mid))
    return author
  return undefined
})
const blockUploader = useBlockUploader()

const { t } = useI18n()
const showContextMenu = ref<boolean>(false)
const showDislikeDialog = ref<boolean>(false)
const showPipWindow = ref<boolean>(false)
const { openIframeDrawer } = useBewlyApp()

enum VideoOption {
  OpenInNewTab,
  OpenInBackground,
  OpenInCurrentTab,
  OpenInNewWindow,
  OpenInDrawer,

  ViewTheOriginalCover,
  ViewThisUserChannel,

  CopyVideoLink,
  CopyBVNumber,
  CopyAVNumber,
}

const commonOptions = computed((): { command: VideoOption, name: string, icon: string, color?: string }[][] => {
  let result = [
    [
      { command: VideoOption.OpenInNewTab, name: t('video_card.operation.open_in_new_tab'), icon: 'i-solar:square-top-down-bold-duotone' },
      { command: VideoOption.OpenInBackground, name: t('video_card.operation.open_in_background'), icon: 'i-solar:square-top-down-bold-duotone' },
      { command: VideoOption.OpenInNewWindow, name: t('video_card.operation.open_in_new_window'), icon: 'i-solar:maximize-square-3-bold-duotone' },
      { command: VideoOption.OpenInCurrentTab, name: t('video_card.operation.open_in_current_tab'), icon: 'i-solar:square-top-down-bold-duotone' },
      { command: VideoOption.OpenInDrawer, name: t('video_card.operation.open_in_drawer'), icon: 'i-solar:archive-up-minimlistic-bold-duotone' },
    ],

    [
      { command: VideoOption.CopyVideoLink, name: t('video_card.operation.copy_video_link'), icon: 'i-solar:copy-bold-duotone' },
      { command: VideoOption.CopyBVNumber, name: t('video_card.operation.copy_bv_number'), icon: 'i-solar:copy-bold-duotone' },
      { command: VideoOption.CopyAVNumber, name: t('video_card.operation.copy_av_number'), icon: 'i-solar:copy-bold-duotone' },
    ],

    [
      { command: VideoOption.ViewTheOriginalCover, name: t('video_card.operation.view_the_original_cover'), icon: 'i-solar:gallery-minimalistic-bold-duotone' },
    ],
  ]
  if (getVideoType() === 'bangumi' || getVideoType() === 'live') {
    result = result.map((group) => {
      return group.filter((opt) => {
        return opt.command !== VideoOption.CopyBVNumber && opt.command !== VideoOption.CopyAVNumber && opt.command !== VideoOption.ViewThisUserChannel
      })
    })
  }
  return result
})

onMounted(() => {
  showContextMenu.value = true
})

function handleBlockUploader() {
  const author = uploader.value
  if (author)
    void blockUploader(author.mid, author.name, author.authorFace)
  handleClose()
}

function handleAppMoreCommand(command: ThreePointV2Type) {
  switch (command) {
    case ThreePointV2Type.Feedback:
      break
    case ThreePointV2Type.Dislike:
      openAppDislikeDialog()
      break
  }
}

function handleCommonCommand(command: VideoOption) {
  switch (command) {
    case VideoOption.OpenInNewTab:
      openLinkToNewTab(props.video.url!)
      handleClose()
      break
    case VideoOption.OpenInBackground:
      openLinkInBackground(props.video.url!)
      handleClose()
      break
    case VideoOption.OpenInNewWindow:
      showPipWindow.value = true
      break
    case VideoOption.OpenInCurrentTab:
      window.open(props.video.url, '_self')
      handleClose()
      break
    case VideoOption.OpenInDrawer:
      openIframeDrawer(props.video.url || '')
      handleClose()
      break

    case VideoOption.CopyVideoLink:
      navigator.clipboard.writeText(props.video.url!)
      handleClose()
      break
    case VideoOption.CopyBVNumber:
      navigator.clipboard.writeText(props.video.bvid!)
      handleClose()
      break
    case VideoOption.CopyAVNumber:
      navigator.clipboard.writeText(`av${props.video.id.toString()}`)
      handleClose()
      break

    case VideoOption.ViewTheOriginalCover:
      window.open(props.video.cover, '_blank')
      handleClose()
      break
  }
}

function openAppDislikeDialog() {
  showDislikeDialog.value = true
  showContextMenu.value = false
}

function handleClose() {
  showContextMenu.value = false
  showPipWindow.value = false
  emit('close')
}

function handleReopen() {
  // showContextMenu.value = false
  // showPipWindow.value = false
  // console.log('reopen')
  // emit('reopen')
  handleClose()
}

function handleRemoved(selectedOpt?: { dislikeReasonId: number }) {
  emit('removed', selectedOpt)
  handleClose()
}
</script>

<template>
  <div>
    <!-- more popup -->
    <div v-if="showContextMenu">
      <div
        style="backdrop-filter: var(--bew-filter-glass-1); box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-1);"
        :style="contextMenuStyles"
        p-1 bg="$bew-elevated" rounded="$bew-radius"
        min-w-200px m="t-4 l-[calc(-200px+1rem)]"
        border="1 $bew-border-color"
        z-10
      >
        <ul flex="~ col gap-1">
          <template v-if="getVideoType() === 'appRcmd'">
            <template v-for="option in video.threePointV2" :key="option.type">
              <li
                v-if="option.type !== ThreePointV2Type.WatchLater && option.type !== ThreePointV2Type.Feedback"
                class="context-menu-item"
                @click="handleAppMoreCommand(option.type)"
              >
                <i class="item-icon" i-solar:confounded-circle-bold-duotone />
                <span v-if="option.type === ThreePointV2Type.Dislike">{{ $t('video_card.operation.not_interested') }}</span>
                <span v-else>{{ option.title }}</span>
              </li>
            </template>
          </template>
          <template v-else-if="showLocalActions">
            <li
              class="context-menu-item"
              @click="handleRemoved()"
            >
              <i class="item-icon" i-solar:confounded-circle-bold-duotone />
              {{ $t('video_card.operation.not_interested') }}
            </li>
            <li
              v-if="uploader"
              class="context-menu-item"
              @click="handleBlockUploader"
            >
              <i class="item-icon" i-mingcute:user-x-line />
              {{ $t('video_card.operation.block_uploader') }}
            </li>
            <div class="divider" />
          </template>

          <template v-for="(optionGroup, index) in commonOptions" :key="index">
            <li
              v-for="option in optionGroup"
              :key="option.command"
              class="context-menu-item"
              @click="handleCommonCommand(option.command)"
            >
              <i class="item-icon" :class="option.icon" />
              {{ option.name }}
            </li>

            <div v-if="index !== commonOptions.length - 1" class="divider" />
          </template>
        </ul>
      </div>
    </div>

    <!-- mask -->
    <div
      v-if="showContextMenu"
      pos="fixed top-0 left-0" w-full h-full
      @click="handleClose"
      @click.right.prevent.stop="handleReopen"
    />

    <DislikeDialog
      v-model="showDislikeDialog"
      :video="video"
      @close="handleClose"
      @removed="handleRemoved"
    />

    <PipWindow
      v-if="showPipWindow"
      :url="video.url"
      @blocked="showPipWindow = false"
      @close="handleClose"
    />
  </div>
</template>

<style lang="scss" scoped>
.context-menu-item {
  --uno: "hover:bg-$bew-fill-2 text-sm px-2.5 py-1.75 rounded-$bew-radius-half cursor-pointer";
  --uno: "flex items-center";
}

.item-icon {
  --uno: "mr-2 inline-block color-$bew-text-color-2";
}

.divider {
  --uno: "w-full h-1px px-2px bg-$bew-border-color";
}
</style>
