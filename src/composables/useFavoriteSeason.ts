import { shallowRef } from 'vue'
import browser from 'webextension-polyfill'

import api from '~/utils/api'
import { requestGeneration } from '~/utils/boundedPagination'
import type { FavoriteSeasonContent, FavoriteSeasonSnapshot } from '~/utils/favoriteSeason'
import { FAVORITE_SEASON_CACHE_KEY, fetchFavoriteSeason, fillFavoriteSeasonAvatars, readFavoriteSeasonSnapshot, sameFavoriteSeason } from '~/utils/favoriteSeason'

interface SeasonSelection {
  account: string
  id: number
  key: string
}

async function readSnapshot(key: string) {
  try {
    const stored = await browser.storage.local.get(FAVORITE_SEASON_CACHE_KEY)
    return readFavoriteSeasonSnapshot(stored[FAVORITE_SEASON_CACHE_KEY], key)
  }
  catch {
    return undefined
  }
}

export function useFavoriteSeason(getAccount: () => string) {
  const content = shallowRef<FavoriteSeasonContent>()
  const isLoading = shallowRef(false)
  const loadFailed = shallowRef(false)
  const generation = requestGeneration()
  const pending = new Map<string, Promise<FavoriteSeasonContent>>()
  let selected: SeasonSelection | undefined

  function refreshInBackground(selection: SeasonSelection) {
    const { account, id, key } = selection
    const existing = pending.get(key)
    if (existing)
      return existing

    const request = (async () => {
      const startedAt = Date.now()
      const sameAccount = () => getAccount() === account
      const fresh = await fetchFavoriteSeason(api.favorite.getFavoriteSeason, id, sameAccount)
      const cached = await readSnapshot(key)
      const result = await fillFavoriteSeasonAvatars(fresh, cached?.content, async (mid, bvid) => {
        if (!sameAccount())
          return
        const { code, data } = await api.video.getVideoInfo({ bvid }, { signal: AbortSignal.timeout(2500) })
        if (code === 0 && data?.owner?.mid === mid)
          return data.owner.face
      })
      if (!sameAccount())
        throw new Error('Favorite season account changed during refresh')
      const snapshot: FavoriteSeasonSnapshot = { startedAt, checkedAt: Date.now(), content: result }
      try {
        const saved = await browser.runtime.sendMessage({ favoriteSeasonCacheUpdate: { key, snapshot } })
        if (saved === false) {
          const newer = await readSnapshot(key)
          if (newer && newer.startedAt > startedAt)
            return newer.content
        }
      }
      catch (error) {
        console.error('[BewlyBruce] Could not save favorite season cache', error)
      }
      return result
    })().finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }

  async function refresh(restore = false) {
    const selection = selected
    if (!selection || selection.account !== getAccount())
      return
    const token = generation.invalidate()
    const current = () => generation.isCurrent(token) && getAccount() === selection.account
    isLoading.value = !content.value
    loadFailed.value = false
    try {
      if (restore) {
        const cached = await readSnapshot(selection.key)
        if (cached && current()) {
          content.value = cached.content
          isLoading.value = false
        }
      }
      const fresh = await refreshInBackground(selection)
      if (current() && !sameFavoriteSeason(content.value, fresh))
        content.value = fresh
    }
    catch {
      if (current())
        loadFailed.value = true
    }
    finally {
      if (generation.isCurrent(token))
        isLoading.value = false
    }
  }

  function clear() {
    generation.invalidate()
    selected = undefined
    content.value = undefined
    isLoading.value = false
    loadFailed.value = false
  }

  function open(id?: number) {
    const account = getAccount()
    if (!id || !account) {
      clear()
      return
    }
    const key = `${account}:${id}`
    if (selected?.key === key)
      return refresh()
    clear()
    selected = { account, id, key }
    return refresh(true)
  }

  return { content, isLoading, loadFailed, open, refresh, clear }
}
