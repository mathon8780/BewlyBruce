import { beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import API_FAVORITE from '~/background/messageListeners/api/favorite'
import API_MOMENT from '~/background/messageListeners/api/moment'
import { setupSearchHistoryMessages } from '~/background/messageListeners/searchHistory'
import { setupStorageMessages } from '~/background/messageListeners/storage'
import { apiListenerFactory } from '~/background/utils'
import { addSearchHistory, clearAllSearchHistory, getSearchHistory, removeSearchHistory } from '~/components/SearchBar/searchHistoryProvider'
import { useStorageLocal } from '~/composables/useStorageLocal'
import { homeTabs, resolveHomeTabVisibility } from '~/contentScripts/views/Home/homeTabs'
import { HomeSubPage } from '~/contentScripts/views/Home/types'
import { originalSettings, parseSettings } from '~/logic/settings'
import { wallpaperSettingsSerializer } from '~/logic/wallpaperStorage'
import { BLOCKED_UPLOADERS_KEY, normalizeUploaderMid, readBlockedUploaders } from '~/utils/blockedUploaders'
import { boundedBackfill } from '~/utils/boundedPagination'
import { compileFilterKeywords } from '~/utils/filterRules'
import { createInflightRequests } from '~/utils/inflightRequest'
import { isVerticalVideo, parseBilibiliUri } from '~/utils/uriParse'

const extension = vi.hoisted(() => {
  const values: Record<string, unknown> = {}
  const messages: ((message: unknown) => Promise<unknown> | undefined)[] = []
  const changes: ((update: Record<string, { newValue?: unknown }>, area: string) => void)[] = []
  type Listener = (message: unknown) => void
  function signal() {
    const listeners = new Set<Listener>()
    return {
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      emit: (message?: unknown) => listeners.forEach(listener => listener(message)),
    }
  }
  const connections = signal()
  function connect({ name }: { name: string }) {
    const serverDisconnect = signal()
    const client = { onMessage: signal(), onDisconnect: signal(), disconnect: () => close(serverDisconnect) }
    const server = {
      name,
      onDisconnect: serverDisconnect,
      postMessage: (message: unknown) => queueMicrotask(() => client.onMessage.emit(message)),
      disconnect: () => close(client.onDisconnect),
    }
    let open = true
    function close(event: ReturnType<typeof signal>) {
      if (open) {
        open = false
        event.emit()
      }
    }
    queueMicrotask(() => connections.emit(server))
    return client
  }
  const local = {
    get: async (key: string) => ({ [key]: values[key] }),
    set: async (items: Record<string, unknown>) => {
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
        connect,
        onConnect: connections,
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

it('serializes local uploader blocks without losing concurrent additions', async () => {
  setupStorageMessages()
  const update = (mid: string, name: string | null, avatar?: string) => extension.messages[0]({ blockedUploaderUpdate: { mid, name, avatar } })
  const largeMid = '9007199254740993'
  expect(normalizeUploaderMid(42)).toBe('42')
  expect(normalizeUploaderMid(Number(largeMid))).toBeUndefined()
  expect(normalizeUploaderMid(largeMid)).toBe(largeMid)

  await expect(Promise.all([update('42', 'A', '//i0.hdslb.com/face/avatar.jpg'), update(largeMid, 'B')])).resolves.toEqual([true, true])
  await expect(update('42', 'Renamed')).resolves.toBe(false)
  await expect(update('__proto__', 'Invalid')).resolves.toBe(false)
  expect(extension.values[BLOCKED_UPLOADERS_KEY]).toEqual({ 42: { name: 'A', avatar: 'https://i0.hdslb.com/face/avatar.jpg' }, [largeMid]: { name: 'B' } })
  await expect(update('42', null)).resolves.toBe(true)
  expect(extension.values[BLOCKED_UPLOADERS_KEY]).toEqual({ [largeMid]: { name: 'B' } })
  expect(extension.values.settings).toBeUndefined()
})

it('keeps names from existing uploader blocks and discards invalid avatar URLs', () => {
  expect(readBlockedUploaders({ 42: 'Existing', 43: { name: 'New', avatar: 'javascript:void(0)' } }))
    .toEqual({ 42: { name: 'Existing' }, 43: { name: 'New' } })
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
  expect(JSON.parse(extension.values.settings as string)).toEqual(a.value)
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

it('serializes search history writes and rejects an acknowledged write that did not persist', async () => {
  setupSearchHistoryMessages()
  const frame = document.createElement('iframe')
  frame.src = 'https://s1.hdslb.com/bfs/seed/jinkela/short/cols/iframe.html'
  document.body.append(frame)
  const target = frame.contentWindow!
  let stored: string | null = null
  let failWrite = false
  const post = vi.spyOn(target, 'postMessage').mockImplementation((request) => {
    const { key, id, type, value } = request
    if (type === 'COLS_SET' && !failWrite)
      stored = value
    else if (type === 'COLS_RM')
      stored = null
    const response = { type: 'COLS_RES', id, key, value: type === 'COLS_GET' ? stored : undefined }
    const send = (data: unknown) => window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://s1.hdslb.com',
      source: target,
      data,
    }))
    queueMicrotask(() => {
      send({ ...response, id: 'unrelated', value: null })
      send(response)
    })
  })
  try {
    await Promise.all([
      addSearchHistory({ value: 'first', timestamp: 1 }),
      addSearchHistory({ value: 'second', timestamp: 2 }),
    ])
    expect(await getSearchHistory()).toEqual([
      { value: 'second', timestamp: 2 },
      { value: 'first', timestamp: 1 },
    ])
    failWrite = true
    await expect(removeSearchHistory('second')).rejects.toThrow('could not be verified')
    expect(await clearAllSearchHistory()).toEqual([])
    expect(await getSearchHistory()).toEqual([])
  }
  finally {
    post.mockRestore()
    frame.remove()
  }
})

it('preserves hidden home tabs and order when the saved catalog differs', () => {
  const config = [
    { page: HomeSubPage.Trending, visible: true },
    { page: HomeSubPage.ForYou, visible: false },
    { page: 'Removed' as HomeSubPage, visible: true },
    { page: HomeSubPage.Following, visible: true },
    { page: HomeSubPage.SubscribedSeries, visible: true },
  ]
  const initial = structuredClone(config)
  const tabs = resolveHomeTabVisibility(config)
  expect(tabs.filter(tab => tab.visible).map(tab => tab.page))
    .toEqual([HomeSubPage.Trending, HomeSubPage.Following, HomeSubPage.SubscribedSeries])
  expect(tabs).toContainEqual({ page: HomeSubPage.Ranking, visible: false })
  expect(tabs).toContainEqual({ page: HomeSubPage.Live, visible: false })
  expect(config).toEqual(initial)
  expect(resolveHomeTabVisibility([]).filter(tab => tab.visible)).toHaveLength(homeTabs.length)
})

it('retries hydration before writing edits and preserves the previously saved home tabs', async () => {
  setupStorageMessages()
  const key = 'settings'
  const tabs = [{ page: HomeSubPage.Following, visible: true }, { page: HomeSubPage.ForYou, visible: false }]
  extension.values[key] = JSON.stringify({ tabList: tabs, layout: { dark: false } })
  const read = vi.spyOn(extension.browser.storage.local, 'get').mockRejectedValueOnce(new Error('offline'))
  const onError = vi.fn()
  try {
    const state = useStorageLocal(key, { tabList: [], layout: { dark: false } }, { debounce: 200, onError })
    await state.ready
    expect(onError).toHaveBeenCalledOnce()
    expect(state.hydrated.value).toBe(false)
    state.value.layout.dark = true
    await state.flush()
    expect(state.hydrated.value).toBe(true)
    expect(state.value).toEqual({ tabList: tabs, layout: { dark: true } })
    expect(JSON.parse(extension.values[key] as string)).toEqual(state.value)
  }
  finally {
    read.mockRestore()
  }
})

it('applies a newer cross-tab setting when the initial deserialize is still pending', async () => {
  const key = 'settings'
  let finish!: () => void
  const initial = { tabList: resolveHomeTabVisibility([]) }
  const next = { tabList: [{ page: HomeSubPage.Following, visible: true }] }
  extension.values[key] = JSON.stringify(initial)
  const read = vi.fn((raw: string) => new Promise<typeof initial>((resolve) => {
    finish = () => resolve(JSON.parse(raw))
  }))
  const serializer = {
    read: async (raw: string) => raw === JSON.stringify(initial) ? read(raw) : JSON.parse(raw),
    write: JSON.stringify,
  }
  const state = useStorageLocal(key, initial, { serializer })
  await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
  await extension.browser.storage.local.set({ [key]: JSON.stringify(next) })
  finish()
  await state.ready
  expect(state.value).toEqual(next)
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

it.each(['{broken', '{"theme":0}'])('recovers invalid stored settings on an explicit reset', async (raw) => {
  setupStorageMessages()
  extension.values.settings = raw
  const onError = vi.fn()
  const state = useStorageLocal('settings', originalSettings, {
    writeDefaults: false,
    serializer: wallpaperSettingsSerializer,
    onError,
  })
  await state.ready
  expect(state.hydrated.value).toBe(true)
  expect(state.value.theme).toBe(originalSettings.theme)
  expect(extension.values.settings).toBe(raw)
  expect(onError).toHaveBeenCalledOnce()

  await state.flush({ recoverInvalid: true })
  expect(JSON.parse(extension.values.settings as string).theme).toBe(originalSettings.theme)
})

it('merges changes into settings already recovered by another tab', async () => {
  setupStorageMessages()
  extension.values.settings = '{broken'
  const state = useStorageLocal('settings', originalSettings, {
    writeDefaults: false,
    serializer: wallpaperSettingsSerializer,
    debounce: 200,
    onError: vi.fn(),
  })
  await state.ready

  // 模拟另一标签页先恢复了存储，但变更事件尚未送达当前页。
  extension.values.settings = JSON.stringify({ theme: 'dark', enableVideoPreview: false })
  state.value.theme = 'light'
  await state.flush()
  expect(JSON.parse(extension.values.settings as string)).toEqual({ theme: 'light', enableVideoPreview: false })
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
