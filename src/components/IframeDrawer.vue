<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import { DRAWER_VIDEO_ENTER_PAGE_FULL, DRAWER_VIDEO_EXIT_PAGE_FULL } from '~/constants/globalEvents'
import { settings } from '~/logic'

const props = defineProps<{
  url: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const openerUrl = location.href
const show = ref(false)
const headerShow = ref(true)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const currentUrl = ref(props.url)
const showIframe = ref(false)
const removeTopBarClassInjected = ref(false)
const isEscPressed = ref(false)
let frameListeners: AbortController | undefined
let escTimer: ReturnType<typeof setTimeout>
let closeTimer: ReturnType<typeof setTimeout>

onMounted(() => {
  history.pushState(null, '', props.url)
  show.value = true
})

function syncFrameUrl() {
  const url = iframeRef.value?.contentDocument?.URL
  if (!url || url === 'about:blank')
    return
  currentUrl.value = url
  // 子页面导航已进入浏览器历史，只同步地址栏。
  if (location.href !== url)
    history.replaceState(history.state, '', url)
}

function onFrameLoad() {
  const frame = iframeRef.value!
  frameListeners?.abort()
  showIframe.value = true
  if (!frame.contentDocument || !frame.contentWindow)
    return
  syncFrameUrl()
  frameListeners = new AbortController()
  const options = { signal: frameListeners.signal }
  for (const event of ['historyChange', 'popstate', 'hashchange'])
    frame.contentWindow.addEventListener(event, syncFrameUrl, options)
  frame.contentWindow.addEventListener('keydown', onFrameKey, options)
  frame.contentDocument.documentElement.classList.add('remove-top-bar-without-placeholder')
  removeTopBarClassInjected.value = true
  frame.focus()
}

function onFrameKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !headerShow.value || event.defaultPrevented || event.repeat)
    return
  if (settings.value.closeDrawerWithoutPressingEscAgain || isEscPressed.value) {
    handleClose()
    return
  }
  isEscPressed.value = true
  escTimer = setTimeout(() => {
    isEscPressed.value = false
  }, 1300)
}

useEventListener(window, 'popstate', () => {
  if (location.href === openerUrl)
    handleClose()
})

useEventListener(window, 'message', ({ data, origin, source }) => {
  if (source !== iframeRef.value?.contentWindow || origin !== location.origin)
    return
  if (data === DRAWER_VIDEO_ENTER_PAGE_FULL)
    headerShow.value = false
  else if (data === DRAWER_VIDEO_EXIT_PAGE_FULL)
    headerShow.value = true
})

function handleClose() {
  if (!show.value)
    return
  frameListeners?.abort()
  show.value = false
  headerShow.value = false
  closeTimer = setTimeout(() => emit('close'), 300)
}

onBeforeUnmount(() => {
  frameListeners?.abort()
  clearTimeout(escTimer)
  clearTimeout(closeTimer)
  if (location.href === currentUrl.value || location.href === new URL(props.url, openerUrl).href)
    history.replaceState(history.state, '', openerUrl)
})

function handleOpenInNewTab() {
  window.open(currentUrl.value, '_blank')
  handleClose()
}
</script>

<template>
  <div pos="absolute top-0 left-0" of-hidden w-full h-full z-999999>
    <!-- Mask -->
    <Transition name="fade">
      <div
        v-if="show" pos="absolute bottom-0 left-0" w-full h-full bg="black opacity-60"
        @click="handleClose"
      />
    </Transition>

    <Transition name="fade">
      <div
        v-if="headerShow"
        pos="relative top-0"
        flex="~ items-center justify-end gap-2"
        max-w="$bew-page-max-width"
        w-full
        h="$bew-top-bar-height"
        m-auto
        px-4
        pointer-events-none
      >
        <Button
          style="--b-button-color: var(--bew-elevated-solid); --b-button-color-hover: var(--bew-elevated-solid-hover)"
          pointer-events-auto
          @click="handleOpenInNewTab"
        >
          <template #left>
            <i i-mingcute:external-link-line />
          </template>
          {{ $t('iframe_drawer.open_in_new_tab') }}
          <!-- <div flex="~">
            <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>T</kbd>
          </div> -->
        </Button>
        <Button
          v-if="!isEscPressed"
          style="--b-button-color: var(--bew-elevated-solid); --b-button-color-hover: var(--bew-elevated-solid-hover)"
          pointer-events-auto
          @click="handleClose"
        >
          <template #left>
            <i i-mingcute:close-line />
          </template>
          {{ $t('iframe_drawer.close') }}
          <kbd>Esc</kbd>
        </Button>
        <Button v-else type="error" @click="handleClose">
          <template #left>
            <i i-mingcute:close-line />
          </template>
          {{ $t('iframe_drawer.press_esc_again_to_close') }}
          <kbd>Esc</kbd>
        </Button>
      </div>
    </Transition>

    <!-- Iframe -->
    <Transition name="drawer">
      <div
        v-if="show"
        :pos="`absolute ${headerShow ? 'top-$bew-top-bar-height' : 'top-0'} left-0`"
        of-hidden
        bg="$bew-bg"
        rounded="t-$bew-radius"
        w-full
        h-full
      >
        <Transition name="fade">
          <iframe
            v-if="show"
            v-show="showIframe"
            ref="iframeRef"
            :src="props.url"
            :style="{
              // Prevent top bar shaking when before the remove-top-bar-without-placeholder class is injected
              top: !removeTopBarClassInjected ? `calc(-1 * var(--bew-top-bar-height))` : '0',
            }"
            frameborder="0"
            pointer-events-auto
            pos="relative left-0"
            w-full
            h-full
            @load="onFrameLoad"
          />
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
}
</style>
