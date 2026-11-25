<script setup lang="ts">
import Button from '~/components/Button.vue'

defineProps<{ compact?: boolean }>()
const emit = defineEmits<{ (event: 'undo'): void }>()
</script>

<template>
  <div
    pos="absolute inset-0"
    flex="~ col items-center justify-center"
    :class="compact ? 'gap-1 text-xs' : 'gap-2 text-lg'"
    bg="$bew-fill-4"
    backdrop-blur-20px
    mix-blend-luminosity
    rounded="$bew-radius"
    z-3
    @click.prevent.stop
  >
    <p :class="{ 'mb-2': !compact }" color-white>
      {{ $t('video_card.video_removed') }}
    </p>
    <button
      v-if="compact" type="button" rounded px-1 color-white
      bg="white/20"
      @click.prevent.stop="emit('undo')"
    >
      {{ $t('common.undo') }}
    </button>
    <Button v-else color="rgba(255,255,255,.35)" text-color="white" size="small" @click.prevent.stop="emit('undo')">
      <template #left>
        <div i-mingcute-back-line text-lg />
      </template>
      {{ $t('common.undo') }}
    </Button>
  </div>
</template>
