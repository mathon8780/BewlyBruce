<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'

import { blockedUploaders, updateBlockedUploader } from '~/logic/blockedUploaders'

import SettingsItemGroup from '../../components/SettingsItemGroup.vue'

const { t } = useI18n()
const toast = useToast()
const pending = reactive(new Set<string>())
const entries = computed(() => Object.entries(blockedUploaders.value))

async function unblock(mid: string) {
  pending.add(mid)
  try {
    await updateBlockedUploader(mid, null)
  }
  catch {
    toast.error(t('common.operation_failed'))
  }
  finally {
    pending.delete(mid)
  }
}

function hideBrokenAvatar(event: Event) {
  if (event.currentTarget instanceof HTMLImageElement)
    event.currentTarget.hidden = true
}
</script>

<template>
  <SettingsItemGroup :title="$t('video_card.blocked_uploaders')" :desc="$t('video_card.blocked_uploaders_desc')">
    <p v-if="!entries.length" py-4 text="$bew-text-2 sm">
      {{ $t('video_card.blocked_uploaders_empty') }}
    </p>
    <ul v-else class="blocked-uploader-list" role="list">
      <li v-for="[mid, uploader] in entries" :key="mid" class="blocked-uploader-row">
        <span class="blocked-uploader-avatar" aria-hidden="true">
          <i i-mingcute:user-3-line text-lg />
          <img
            v-if="uploader.avatar"
            :key="uploader.avatar"
            :src="uploader.avatar"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="hideBrokenAvatar"
          >
        </span>
        <span min-w-0 break-words>{{ uploader.name || `UID ${mid}` }}</span>
        <Button size="small" type="secondary" shrink-0 :disabled="pending.has(mid)" @click="unblock(mid)">
          {{ $t('video_card.unblock_uploader') }}
        </Button>
      </li>
    </ul>
  </SettingsItemGroup>
</template>

<style lang="scss" scoped>
.blocked-uploader-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding-block: 12px;
}

.blocked-uploader-row + .blocked-uploader-row {
  border-top: 1px solid var(--bew-border-color);
}

.blocked-uploader-avatar {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bew-fill-2);
  color: var(--bew-text-2);

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
</style>
