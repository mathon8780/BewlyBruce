<script setup lang="ts">
import { useDark } from '~/composables/useDark'

const props = defineProps<{
  url: string
}>()

const emit = defineEmits<{
  (e: 'close' | 'blocked'): void
}>()

const pipWindow = shallowRef<Window>()
const { isDark } = useDark()
let mounted = true

onMounted(async () => {
  const width = window.innerWidth * 0.8
  const height = window.innerHeight * 0.8
  const api = (window as Window & {
    documentPictureInPicture?: { requestWindow: (options: object) => Promise<Window> }
  }).documentPictureInPicture
  const popup = await api?.requestWindow({ width, height, disallowReturnToOpener: true }).catch(() => undefined)
  if (!mounted) {
    popup?.close()
    return
  }
  if (popup) {
    popup.document.body.style.margin = '0'
    popup.document.documentElement.classList.toggle('dark', isDark.value)
    popup.addEventListener('pagehide', () => emit('close'), { once: true })
    pipWindow.value = popup
    return
  }
  const left = (screen.width - width) / 2
  const top = (screen.height - height) / 2
  if (window.open(props.url, '_blank', `popup,width=${width},height=${height},left=${left},top=${top}`))
    emit('close')
  else
    emit('blocked')
})

function openVideoTab() {
  window.open(props.url, '_blank')
  emit('close')
}

onBeforeUnmount(() => {
  mounted = false
  pipWindow.value?.close()
})
</script>

<template>
  <Teleport v-if="pipWindow" :to="pipWindow.document.body">
    <div pos="absolute top-0 left-0" w-full h-full>
      <div
        pos="relative top-0" z-1 flex="~ items-center justify-end gap-2"
        w-full h="$bew-top-bar-height"
        pointer-events-none
      >
        <Button
          style="
              --b-button-color: var(--bew-elevated-solid);
              --b-button-color-hover: var(--bew-elevated-solid-hover);
            "
          pointer-events-auto
          @click="openVideoTab"
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
          style="
            --b-button-color: var(--bew-elevated-solid);
            --b-button-color-hover: var(--bew-elevated-solid-hover);
          "
          pointer-events-auto
          mr-8
          @click="emit('close')"
        >
          <template #left>
            <i i-mingcute:close-line />
          </template>
          {{ $t('iframe_drawer.close') }}
          <!-- <kbd>Esc</kbd> -->
        </Button>
      </div>
      <iframe
        :src="url" frameborder="0"
        w-full h-full p-0
        pos="absolute top-0 left-0"
        bg="$bew-bg"
      />
    </div>
  </Teleport>
</template>
