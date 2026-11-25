<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

import { useBewlyApp } from '~/composables/useAppProvider'
import { useBlockUploader } from '~/composables/useBlockUploader'
import { useVideoCardState } from '~/composables/useVideoCardState'
import { normalizeUploaderMid } from '~/utils/blockedUploaders'

import VideoRemovedCover from './VideoRemovedCover.vue'

const props = defineProps<{
  videoId: number
  bvid?: string
  uploaderMid?: number
  uploaderName?: string
  uploaderAvatar?: string
  compact?: boolean
}>()

const { mainAppRef } = useBewlyApp()
const card = useVideoCardState(() => ({ id: props.videoId, bvid: props.bvid }))
const blockUploader = useBlockUploader()
const mid = computed(() => normalizeUploaderMid(props.uploaderMid))
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const popup = shallowRef<HTMLElement>()
const menuPosition = ref<{ top?: string, bottom?: string, left: string }>()

function closeMenu() {
  menuPosition.value = undefined
}

watch(panel, (element, _, onCleanup) => {
  if (!element)
    return
  const stopOutside = onClickOutside(element, closeMenu, { ignore: [trigger] })
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
  onCleanup(() => {
    stopOutside()
    window.removeEventListener('scroll', closeMenu, true)
    window.removeEventListener('resize', closeMenu)
  })
})

async function toggleMenu() {
  if (menuPosition.value) {
    closeMenu()
    return
  }
  const target = trigger.value
  if (!target)
    return
  const rect = target.getBoundingClientRect()
  // 紧凑列表的菜单留在顶栏弹层内，鼠标移过去时仍处于原弹层的悬停范围。
  popup.value = props.compact ? target.closest<HTMLElement>('.bew-popover') ?? undefined : undefined
  const bounds = popup.value?.getBoundingClientRect()
  const top = (bounds?.top ?? 0) - (popup.value?.scrollTop ?? 0)
  const bottom = (bounds?.bottom ?? window.innerHeight) - (popup.value?.scrollTop ?? 0)
  const leftEdge = bounds?.left ?? 0
  const rightEdge = bounds?.right ?? window.innerWidth
  const left = Math.max(leftEdge + 8, Math.min(rightEdge - 184, rect.right - 176)) - leftEdge
  menuPosition.value = (bounds?.bottom ?? window.innerHeight) - rect.bottom >= 88
    ? { left: `${left}px`, top: `${rect.bottom - top + 4}px` }
    : { left: `${left}px`, bottom: `${bottom - rect.top + 4}px` }
  await nextTick()
  panel.value?.querySelector('button')?.focus()
}

function dismissMenu() {
  closeMenu()
  trigger.value?.focus()
}

function removeVideo() {
  card.value.removed = true
  closeMenu()
}

function handleBlock() {
  closeMenu()
  void blockUploader(mid.value, props.uploaderName, props.uploaderAvatar)
}
</script>

<template>
  <VideoRemovedCover v-if="card.removed" :compact="compact" @undo="card.removed = false" />
  <template v-else>
    <button
      ref="trigger"
      type="button"
      pos="absolute top-1" z-3
      grid="~ place-items-center"
      :class="compact ? 'size-6 left-1' : 'size-8 right-1'"
      rounded-full bg="black/60 hover:black/80" text-white
      :aria-label="$t('video_card.operation.more_actions')"
      :aria-expanded="!!menuPosition"
      @click.prevent.stop="toggleMenu"
    >
      <i i-mingcute:more-2-fill aria-hidden="true" />
    </button>
    <Teleport v-if="menuPosition && mainAppRef" :to="popup ?? mainAppRef">
      <div
        ref="panel"
        :class="popup ? 'absolute' : 'fixed'" z-10010
        w-176px p-1
        bg="$bew-elevated" border="1 $bew-border-color" rounded="$bew-radius" shadow="$bew-shadow-2"
        :style="menuPosition"
        @keydown.esc.stop="dismissMenu"
      >
        <button
          type="button" w-full p="x-3 y-2"
          text-left rounded="$bew-radius-half" hover:bg="$bew-fill-2"
          @click.stop="removeVideo"
        >
          {{ $t('video_card.operation.not_interested') }}
        </button>
        <button
          v-if="mid" type="button" w-full p="x-3 y-2"
          text-left rounded="$bew-radius-half" hover:bg="$bew-fill-2"
          @click.stop="handleBlock"
        >
          {{ $t('video_card.operation.block_uploader') }}
        </button>
      </div>
    </Teleport>
  </template>
</template>
