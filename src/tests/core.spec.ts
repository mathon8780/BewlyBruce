import { beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import API_FAVORITE from '~/background/messageListeners/api/favorite'
import API_MOMENT from '~/background/messageListeners/api/moment'
import { setupStorageMessages } from '~/background/messageListeners/storage'
import { apiListenerFactory } from '~/background/utils'
import { useStorageLocal } from '~/composables/useStorageLocal'
import { originalSettings, parseSettings } from '~/logic/settings'
import { wallpaperSettingsSerializer } from '~/logic/wallpaperStorage'
import { boundedBackfill } from '~/utils/boundedPagination'
import { compileFilterKeywords } from '~/utils/filterRules'
import { createInflightRequests } from '~/utils/inflightRequest'
import { isVerticalVideo, parseBilibiliUri } from '~/utils/uriParse'

const extension = vi.hoisted(() => {
  const values: Record<string, string> = {}
  const messages: ((message: unknown) => Promise<void> | undefined)[] = []
  const changes: ((update: Record<string, { newValue?: string }>, area: string) => void)[] = []
  const local = {
    get: async (key: string) => ({ [key]: values[key] }),
    set: async (items: Record<string, string>) => {
      Object.assign(values, items)
      const update = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { newValue }]))
      changes.forEach(listener => listener(update, 'local'))
    },
    remove: async (key: string) => {
      delete values[key]
      changes.forEach(listener => listener({ [key]: {} }, 'local'))
    },
  }
  return {
    values,
    messages,
    changes,
    browser: {
      storage: { local, onChanged: { addListener: (listener: (typeof changes)[number]) => changes.push(listener) } },
      runtime: {
        onMessage: { addListener: (listener: (typeof messages)[number]) => messages.push(listener) },
        sendMessage: async (message: unknown) => {
          await Promise.all(messages.map(listener => listener(message)))
        },
      },
    },
  }
})
vi.mock('webextension-polyfill', () => ({ default: extension.browser, storage: extension.browser.storage }))
beforeEach(() => {
  extension.messages.length = 0
  extension.changes.length = 0
  Object.keys(extension.values).forEach(key => delete extension.values[key])
})

it('omits the initial feed cursor and preserves large cursor IDs exactly', async () => {
  const fetch = vi.fn(async (_input: string) => new Response(JSON.stringify({ code: 0 })))
  vi.stubEnv('FIREFOX', '')
  vi.stubGlobal('fetch', fetch)
  try {
    const listener = apiListenerFactory(API_MOMENT)
    await listener({ contentScriptQuery: 'getMoments', type: 'video', offset: '' })
    expect(new URL(fetch.mock.calls[0][0]).searchParams.has('offset')).toBe(false)
    const offset = '1234567890123456789'
    await listener({ contentScriptQuery: 'getMoments', type: 'video', offset })
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('offset')).toBe(offset)
  }
  finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})

it('sends native favorite mutations with form data for the correct folder and resource scope', async () => {
  const transfer = { src_media_id: 41, tar_media_id: 82, mid: '12345678901234567', resources: '12:2,25:12' }
  const requests = [
    { query: 'copyFavoriteResources', endpoint: 'copy', params: transfer },
    { query: 'moveFavoriteResources', endpoint: 'move', params: transfer },
    { query: 'cleanFavoriteResources', endpoint: 'clean', params: { media_id: 41 } },
    { query: 'patchDelFavoriteResources', endpoint: 'batch-del', params: { media_id: 41, resources: '12:2' } },
  ]
  const fetch = vi.fn(async (_url: string, _options: RequestInit) => new Response(JSON.stringify({ code: 0 })))
  vi.stubEnv('FIREFOX', '')
  vi.stubGlobal('fetch', fetch)
  try {
    const listener = apiListenerFactory(API_FAVORITE)
    for (const { query, endpoint, params } of requests) {
      await expect(listener({ contentScriptQuery: query, ...params, csrf: 'test-token' })).resolves.toEqual({ code: 0 })
      const [url, options] = fetch.mock.lastCall!
      expect(url).toBe(`https://api.bilibili.com/x/v3/fav/resource/${endpoint}`)
      expect(options.method).toBe('post')
      expect(options.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' })
      expect(options.body).toBeInstanceOf(URLSearchParams)
      const expected = { ...params, platform: 'web', csrf: 'test-token' }
      expect(Object.fromEntries(options.body as URLSearchParams))
        .toEqual(Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, String(value)])))
    }
  }
  finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})

it('stops backfill on empty results and limits a load cycle', async () => {
  const empty = vi.fn(async () => ({ added: 0, done: false }))
  await boundedBackfill({ current: () => true, loadPage: empty, needsMore: async () => true })
  expect(empty).toHaveBeenCalledTimes(1)

  const page = vi.fn(async () => ({ added: 30, done: false }))
  await boundedBackfill({ current: () => true, loadPage: page, needsMore: async () => true })
  expect(page).toHaveBeenCalledTimes(5)
})

it('keeps valid filter rules usable while an expression is incomplete', () => {
  const rules = compileFilterKeywords([{ keyword: '/[/' }, { keyword: '/advert.*/' }, { keyword: 'author' }])
  expect(rules.exact.has('AUTHOR')).toBe(true)
  expect(rules.patterns.some(pattern => pattern.test('Advertisement'))).toBe(true)
})

it('shares previews and cancels only after the final consumer leaves', async () => {
  const request = createInflightRequests()
  const first = new AbortController()
  const second = new AbortController()
  let finish!: (url: string) => void
  let shared!: AbortSignal
  const load = vi.fn((signal: AbortSignal) => {
    shared = signal
    return new Promise<string>((resolve) => {
      finish = resolve
    })
  })
  const a = request('video', load, first.signal)
  const b = request('video', load, second.signal)
  await Promise.resolve()
  first.abort()
  await expect(a).rejects.toBeDefined()
  expect(shared.aborted).toBe(false)
  finish('preview.mp4')
  expect(await b).toBe('preview.mp4')
  const last = new AbortController()
  const c = request('video', load, last.signal)
  await Promise.resolve()
  last.abort()
  await expect(c).rejects.toBeDefined()
  expect(shared.aborted).toBe(true)
  expect(load).toHaveBeenCalledTimes(2)
})

it('merges simultaneous tab edits and propagates logout', async () => {
  setupStorageMessages()
  const a = useStorageLocal('settings', ref({ theme: 'auto', blockAdsAndPromotions: false }), { debounce: 200 })
  const b = useStorageLocal('settings', ref({ theme: 'auto', blockAdsAndPromotions: false }), { debounce: 200 })
  await Promise.all([a.ready, b.ready])
  a.value.theme = 'dark'
  b.value.blockAdsAndPromotions = true
  await Promise.all([a.flush(), b.flush()])
  await vi.waitFor(() => {
    expect(a.value).toEqual({ theme: 'dark', blockAdsAndPromotions: true })
    expect(b.value).toEqual(a.value)
  })
  expect(JSON.parse(extension.values.settings)).toEqual(a.value)
  const keyA = useStorageLocal('accessKey', '')
  const keyB = useStorageLocal('accessKey', '')
  await Promise.all([keyA.ready, keyB.ready])
  keyA.value = 'login'
  await keyA.flush()
  await vi.waitFor(() => expect(keyB.value).toBe('login'))
  keyA.value = null
  await keyA.flush()
  await vi.waitFor(() => expect(keyB.value).toBe(''))
  expect(extension.values.accessKey).toBeUndefined()
})

it('inherits enabled ad options and keeps a later explicit choice after reload', async () => {
  for (const key of ['blockAds', 'blockTopSearchPageAds', 'blockVideoActivities']) {
    const settings = parseSettings({ [key]: true })
    expect(settings.blockAdsAndPromotions).toBe(true)
    expect(settings.blockRelatedVideos).toBe(false)
    expect(settings).not.toHaveProperty(key)
  }

  setupStorageMessages()
  extension.values.settings = JSON.stringify({ blockAds: false, blockVideoActivities: true, blockRelatedVideos: true })
  const options = { serializer: wallpaperSettingsSerializer, debounce: 200 }
  const settings = useStorageLocal('settings', ref(structuredClone(originalSettings)), options)
  await settings.ready
  expect(settings.value.blockAdsAndPromotions).toBe(true)
  expect(settings.value.blockRelatedVideos).toBe(true)
  settings.value.blockAdsAndPromotions = false
  await settings.flush()

  const reloaded = useStorageLocal('settings', ref(structuredClone(originalSettings)), options)
  await reloaded.ready
  expect(reloaded.value.blockAdsAndPromotions).toBe(false)
  expect(reloaded.value.blockRelatedVideos).toBe(true)
})

it('rejects invalid imports before replacing settings', () => {
  expect(() => parseSettings({ theme: 'other' })).toThrow('theme')
  expect(() => parseSettings({ filterByTitle: [{ keyword: null, remark: '' }] })).toThrow('filterByTitle')
  expect(parseSettings({ theme: 'dark', wallpaperMaskOpacity: 50 })).toMatchObject({
    theme: 'dark',
    wallpaperMaskOpacity: 50,
  })
})

it('keeps URI query values intact and recognizes vertical videos', () => {
  const video = parseBilibiliUri('bilibili://video/1?cid=12&trackid=a?b&player_width=720&player_height=1280#x')
  expect(video).toMatchObject({ cid: '12', trackid: 'a?b' })
  expect(isVerticalVideo('bilibili://video/1?player_width=720&player_height=1280')).toBe(true)
})
