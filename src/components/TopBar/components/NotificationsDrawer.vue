<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

import { useBewlyApp } from '~/composables/useAppProvider'
import { settings } from '~/logic'

const props = defineProps<{
  url: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { mainAppRef } = useBewlyApp()
const show = ref(false)
const drawerRef = ref<HTMLElement>()
const iframeRef = ref<HTMLIFrameElement>()
const showIframe = ref(false)
const currentUrl = computed(() => props.url || 'https://message.bilibili.com/')
const isEscPressed = ref(false)
let escPressedTimer: ReturnType<typeof setTimeout> | undefined

onMounted(async () => {
  show.value = true
  await nextTick()
  drawerRef.value?.focus()
})
onBeforeUnmount(() => clearTimeout(escPressedTimer))

function handleClose() {
  clearTimeout(escPressedTimer)
  show.value = false
}

function handleOpenInNewTab() {
  let url = currentUrl.value
  try {
    url = iframeRef.value?.contentWindow?.location.href || url
  }
  catch {
    // 跨域时沿用当前抽屉的通知地址。
  }
  window.open(url, '_blank')
  handleClose()
}

onKeyStroke('Escape', (event) => {
  if (!show.value)
    return
  event.preventDefault()
  if (settings.value.closeDrawerWithoutPressingEscAgain || isEscPressed.value) {
    handleClose()
    return
  }
  isEscPressed.value = true
  escPressedTimer = setTimeout(() => {
    isEscPressed.value = false
  }, 1300)
})
</script>

<template>
  <Teleport :to="mainAppRef">
    <div
      :style="{ pointerEvents: show ? 'auto' : 'none' }"
      pos="fixed top-0 left-0" of-hidden w-full h-full
      z-999999
    >
      <!-- Mask -->
      <Transition name="fade">
        <div
          v-if="show"
          pos="absolute bottom-0 left-0" w-full h-full bg="black opacity-60"
          @click="handleClose"
        />
      </Transition>

      <Transition name="drawer" @after-leave="emit('close')">
        <div
          v-show="show"
          ref="drawerRef"
          tabindex="-1"
          pos="absolute top-0 right-0" of-hidden bg="$bew-bg"
          w="xl:70vw lg:80vw md:100vw 100vw" max-w-1400px h-full
        >
          <div
            pos="fixed top-0 right-0" z-10 flex="~ items-center justify-between gap-2"
            w-inherit max-w-inherit h="$bew-top-bar-height"
            m-auto px-4
            pointer-events-none
          >
            <h3 text="xl" fw-bold>
              {{ $t('topbar.notifications') }}
            </h3>
            <div flex="~ items-center gap-2">
              <Button
                style="
                  --b-button-color: var(--bew-elevated-solid);
                  --b-button-color-hover: var(--bew-elevated-solid-hover);
                "
                pointer-events-auto
                shadow="!$bew-shadow-1"
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
                style="
                  --b-button-color: var(--bew-elevated-solid);
                  --b-button-color-hover: var(--bew-elevated-solid-hover);
                "
                pointer-events-auto
                shadow="!$bew-shadow-1"
                @click="handleClose"
              >
                <template #left>
                  <i i-mingcute:close-line />
                </template>
                {{ $t('iframe_drawer.close') }}
                <kbd>Esc</kbd>
              </Button>
              <Button
                v-else
                type="error"
                shadow="!$bew-shadow-1"
                @click="handleClose"
              >
                <template #left>
                  <i i-mingcute:close-line />
                </template>
                {{ $t('iframe_drawer.press_esc_again_to_close') }}
                <kbd>Esc</kbd>
              </Button>
            </div>
          </div>

          <Transition name="fade">
            <Loading
              v-if="!showIframe"
              pos="absolute top-0 right-0" of-hidden
              w-full h-full
            />
          </Transition>

          <Transition name="fade">
            <!-- Iframe -->
            <iframe
              v-show="showIframe"
              ref="iframeRef"
              :src="currentUrl"
              frameborder="0"
              pointer-events-auto
              pos="relative right-0"
              w-inherit
              max-w-inherit h-full @load="showIframe = true"
            />
          </Transition>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
