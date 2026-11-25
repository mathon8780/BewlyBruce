<script setup lang="ts">
const props = defineProps<{ message: string, undoLabel: string, closeLabel: string, undo: () => Promise<boolean> }>()
const emit = defineEmits<{ (event: 'close-toast'): void }>()
const undoing = ref(false)

async function handleUndo() {
  undoing.value = true
  try {
    if (await props.undo())
      emit('close-toast')
  }
  finally {
    undoing.value = false
  }
}
</script>

<template>
  <div class="blocked-uploader-notice">
    <span class="notice-icon" aria-hidden="true">
      <i i-mingcute:user-x-line />
    </span>
    <p class="notice-message" :title="message">
      {{ message }}
    </p>
    <button type="button" class="notice-undo" :disabled="undoing" @click.stop="handleUndo">
      {{ undoLabel }}
    </button>
    <button type="button" class="notice-close" :aria-label="closeLabel" @click.stop="emit('close-toast')">
      <i i-mingcute:close-line aria-hidden="true" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
:global(.Vue-Toastification__toast.bewly-blocked-uploader-toast) {
  --bew-blocked-notice-enter-duration: 140ms;
  --bew-blocked-notice-leave-duration: 100ms;
  --bew-blocked-notice-move-duration: 140ms;
  --bew-blocked-notice-progress-height: 4px;
  width: min(22rem, calc(100vw - 2rem));
  min-width: 0;
  min-height: 64px;
  padding: 12px 10px 14px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated-solid);
  color: var(--bew-text-1);
  box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-2);
  font-family: inherit;
}

:global(.Vue-Toastification__toast.bewly-blocked-uploader-toast::after) {
  position: absolute;
  inset: auto 0 0;
  height: var(--bew-blocked-notice-progress-height);
  background: var(--bew-fill-2);
  content: "";
}

:global(.bewly-blocked-uploader-toast .Vue-Toastification__progress-bar) {
  height: var(--bew-blocked-notice-progress-height);
  background: var(--bew-theme-color);
}

:global(.bewly-blocked-uploader-toast.Vue-Toastification__fade-enter-active.bottom-right) {
  animation: blocked-notice-enter var(--bew-blocked-notice-enter-duration) ease-out both;
}

:global(.bewly-blocked-uploader-toast.Vue-Toastification__fade-leave-active.bottom-right:not(.disable-transition)) {
  animation: blocked-notice-leave var(--bew-blocked-notice-leave-duration) ease-in both;
}

:global(.bewly-blocked-uploader-toast.Vue-Toastification__fade-move) {
  transition: transform var(--bew-blocked-notice-move-duration) ease-out;
}

@keyframes blocked-notice-enter {
  from {
    opacity: 0;
    transform: translateX(calc(100% + 2rem));
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes blocked-notice-leave {
  to {
    opacity: 0;
    transform: translateY(4px);
  }
}

:global(.Vue-Toastification__toast-component-body.bewly-blocked-uploader-toast-body) {
  flex: 1;
  min-width: 0;
}

.blocked-uploader-notice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 9px;
  line-height: 1.4;
}

.notice-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--bew-radius-half);
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-size: 18px;
}

.notice-message {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
}

.notice-undo,
.notice-close {
  border-radius: var(--bew-radius-half);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.notice-undo {
  padding: 6px 9px;
  background: var(--bew-fill-1);
  white-space: nowrap;
  font-size: 13px;

  &:hover {
    background: var(--bew-fill-2);
  }

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }
}

.notice-close {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  color: var(--bew-text-2);
  font-size: 17px;

  &:hover {
    background: var(--bew-fill-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(.Vue-Toastification__toast.bewly-blocked-uploader-toast) {
    --bew-blocked-notice-enter-duration: 0.01ms;
    --bew-blocked-notice-leave-duration: 0.01ms;
    --bew-blocked-notice-move-duration: 0.01ms;
  }
}
</style>
