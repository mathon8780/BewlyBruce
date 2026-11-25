import browser from 'webextension-polyfill'

import type { BlockedUploaderUpdate } from '~/utils/blockedUploaders'
import { BLOCKED_UPLOADERS_KEY, normalizeUploaderAvatar, normalizeUploaderMid, readBlockedUploaders } from '~/utils/blockedUploaders'
import type { FavoriteCategoryOrderUpdate } from '~/utils/favoriteCategoryOrder'
import { favoriteCategoryOrderKey, updateFavoriteCategoryOrder } from '~/utils/favoriteCategoryOrder'
import type { FavoriteSeasonCacheUpdate } from '~/utils/favoriteSeason'
import { FAVORITE_SEASON_CACHE_KEY, updateFavoriteSeasonCache } from '~/utils/favoriteSeason'

interface StorageWrite {
  key: string
  raw: string | null
  patch?: Record<string, unknown>
  replaceIf?: { raw: unknown }
}

export function setupStorageMessages() {
  let writes = Promise.resolve()
  browser.runtime.onMessage.addListener((message: unknown) => {
    const { storageWrite, blockedUploaderUpdate, favoriteSeasonCacheUpdate, favoriteCategoryOrderUpdate } = (message ?? {}) as {
      storageWrite?: StorageWrite
      blockedUploaderUpdate?: BlockedUploaderUpdate
      favoriteSeasonCacheUpdate?: FavoriteSeasonCacheUpdate
      favoriteCategoryOrderUpdate?: FavoriteCategoryOrderUpdate
    }
    if (!storageWrite && !blockedUploaderUpdate && !favoriteSeasonCacheUpdate && !favoriteCategoryOrderUpdate)
      return
    const result = writes.then(async () => {
      if (favoriteCategoryOrderUpdate) {
        const { account } = favoriteCategoryOrderUpdate
        if (typeof account !== 'string' || !/^\d+$/.test(account))
          return
        const key = favoriteCategoryOrderKey(account)
        const previous = (await browser.storage.local.get(key))[key]
        const updated = updateFavoriteCategoryOrder(previous, favoriteCategoryOrderUpdate)
        if (JSON.stringify(updated) !== JSON.stringify(previous))
          await browser.storage.local.set({ [key]: updated })
        return updated
      }
      if (favoriteSeasonCacheUpdate) {
        const stored = (await browser.storage.local.get(FAVORITE_SEASON_CACHE_KEY))[FAVORITE_SEASON_CACHE_KEY]
        const updated = updateFavoriteSeasonCache(stored, favoriteSeasonCacheUpdate)
        if (updated)
          await browser.storage.local.set({ [FAVORITE_SEASON_CACHE_KEY]: updated })
        return !!updated
      }
      if (blockedUploaderUpdate) {
        const { mid, name } = blockedUploaderUpdate
        if (typeof mid !== 'string' || !normalizeUploaderMid(mid) || (name !== null && typeof name !== 'string'))
          return false
        const stored = await browser.storage.local.get(BLOCKED_UPLOADERS_KEY)
        const uploaders = { ...readBlockedUploaders(stored[BLOCKED_UPLOADERS_KEY]) }
        if (Object.hasOwn(uploaders, mid) === (name !== null))
          return false
        if (name === null) {
          delete uploaders[mid]
        }
        else {
          const avatar = normalizeUploaderAvatar(blockedUploaderUpdate.avatar)
          uploaders[mid] = { name, ...(avatar && { avatar }) }
        }
        await browser.storage.local.set({ [BLOCKED_UPLOADERS_KEY]: uploaders })
        return true
      }

      const { key, raw, patch, replaceIf } = storageWrite!
      if (raw === null) {
        await browser.storage.local.remove(key)
      }
      else {
        const stored = (await browser.storage.local.get(key))[key]
        // 仅当存储仍是读取时发现的损坏值，才用完整快照替换它。
        const needsRecovery = replaceIf && JSON.stringify(stored) === JSON.stringify(replaceIf.raw)
        const value = patch && !needsRecovery
          ? JSON.stringify({ ...(stored ? JSON.parse(stored as string) : {}), ...patch })
          : raw
        await browser.storage.local.set({ [key]: value })
      }
    })
    writes = result.then(() => {}, console.error)
    return result
  })
}
