import { shallowRef } from 'vue'
import browser from 'webextension-polyfill'

import type { BlockedUploaders, BlockedUploaderUpdate } from '~/utils/blockedUploaders'
import { BLOCKED_UPLOADERS_KEY, normalizeUploaderMid, readBlockedUploaders } from '~/utils/blockedUploaders'

export const blockedUploaders = shallowRef<BlockedUploaders>({})

let storageChanged = false
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[BLOCKED_UPLOADERS_KEY]) {
    storageChanged = true
    blockedUploaders.value = readBlockedUploaders(changes[BLOCKED_UPLOADERS_KEY].newValue)
  }
})

export const blockedUploadersReady = browser.storage.local.get(BLOCKED_UPLOADERS_KEY).then((stored) => {
  if (!storageChanged)
    blockedUploaders.value = readBlockedUploaders(stored[BLOCKED_UPLOADERS_KEY])
}).catch(console.error)

export function isUploaderBlocked(mid: unknown): boolean {
  const id = normalizeUploaderMid(mid)
  return !!id && Object.hasOwn(blockedUploaders.value, id)
}

export function filterBlockedUploaders<T>(items: T[], getMid: (item: T) => unknown): T[] {
  if (!Object.keys(blockedUploaders.value).length)
    return items
  return items.filter(item => !isUploaderBlocked(getMid(item)))
}

export async function updateBlockedUploader(mid: unknown, name: string | null, avatar?: string): Promise<boolean> {
  const id = normalizeUploaderMid(mid)
  if (!id)
    return false
  const blockedUploaderUpdate: BlockedUploaderUpdate = { mid: id, name, avatar }
  return (await browser.runtime.sendMessage({ blockedUploaderUpdate })) === true
}
