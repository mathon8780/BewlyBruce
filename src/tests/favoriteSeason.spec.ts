import { beforeEach, expect, it, vi } from 'vitest'

import { useFavoriteSeason } from '~/composables/useFavoriteSeason'
import type { FavoriteSeasonResult, FavoriteSeasonVideo } from '~/models/video/favorite'
import type { FavoriteSeasonCacheUpdate, FavoriteSeasonContent } from '~/utils/favoriteSeason'
import { fetchFavoriteSeason, readFavoriteSeasonSnapshot, updateFavoriteSeasonCache } from '~/utils/favoriteSeason'

const mock = vi.hoisted(() => ({
  stored: undefined as unknown,
  request: vi.fn(),
  videoInfo: vi.fn(),
  send: vi.fn(),
}))

vi.mock('~/utils/api', () => ({
  default: { favorite: { getFavoriteSeason: mock.request }, video: { getVideoInfo: mock.videoInfo } },
}))
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: { local: { get: async (key: string) => ({ [key]: structuredClone(mock.stored) }) } },
    runtime: { sendMessage: mock.send },
  },
}))

function video(id: number, pubtime = id): FavoriteSeasonVideo {
  return {
    id,
    bvid: `BV${id}`,
    pubtime,
    title: `Video ${id}`,
    cover: '',
    duration: 10,
    upper: { mid: 1, name: 'Author', face: '' },
    cnt_info: { play: 0, danmaku: 0 },
  }
}

function response(medias: FavoriteSeasonVideo[], count = medias.length): FavoriteSeasonResult {
  return { code: 0, message: '', data: { info: { title: 'Collection', cover: '', media_count: count }, medias } }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => (resolve = done))
  return { promise, resolve }
}

function seed(key: string, items: FavoriteSeasonVideo[]) {
  const content: FavoriteSeasonContent = { title: 'Collection', cover: '', count: items.length, items }
  mock.stored = updateFavoriteSeasonCache(mock.stored, { key, snapshot: { startedAt: 1, checkedAt: 2, content } })
  return content
}

beforeEach(() => {
  mock.stored = undefined
  mock.request.mockReset()
  mock.videoInfo.mockReset().mockResolvedValue({ code: -404 })
  mock.send.mockReset().mockImplementation(async ({ favoriteSeasonCacheUpdate }: { favoriteSeasonCacheUpdate: FavoriteSeasonCacheUpdate }) => {
    const updated = updateFavoriteSeasonCache(mock.stored, structuredClone(favoriteSeasonCacheUpdate))
    if (updated)
      mock.stored = updated
    return !!updated
  })
})

it('sorts a complete collection across pages and puts undated videos last', async () => {
  mock.request.mockResolvedValueOnce(response(Array.from({ length: 20 }, (_, i) => video(i + 1)), 22))
    .mockResolvedValueOnce(response([video(21, 0), video(22, 100)], 22))

  const result = await fetchFavoriteSeason(mock.request, 9, () => true)

  expect(mock.request.mock.calls.map(([request]) => request.pn)).toEqual([1, 2])
  expect(result.items.map(item => item.id)).toEqual([22, ...Array.from({ length: 20 }, (_, i) => 20 - i), 21])
})

it('accepts a full collection returned in one response even when it exceeds the requested page size', async () => {
  mock.request.mockResolvedValue(response(Array.from({ length: 22 }, (_, i) => video(i + 1))))

  const result = await fetchFavoriteSeason(mock.request, 9, () => true)

  expect(mock.request).toHaveBeenCalledTimes(1)
  expect(result.items).toHaveLength(22)
  expect(result.items[0].id).toBe(22)
})

it('shows saved content while checking and keeps its identity when the server content matches', async () => {
  const old = seed('1:9', [video(1)])
  const server = deferred<FavoriteSeasonResult>()
  mock.request.mockReturnValue(server.promise)
  const feed = useFavoriteSeason(() => '1')

  const refresh = feed.open(9)
  await vi.waitFor(() => expect(feed.content.value).toEqual(old))
  expect(feed.isLoading.value).toBe(false)
  expect(mock.request).toHaveBeenCalledTimes(1)
  const visible = feed.content.value
  server.resolve(response(old.items))
  await refresh

  expect(feed.content.value).toBe(visible)
  expect(readFavoriteSeasonSnapshot(mock.stored, '1:9')?.checkedAt).toBeGreaterThan(2)
})

it('loads one avatar per missing uploader and reuses the resulting avatar in the cached collection', async () => {
  const original = [video(2), video(1), { ...video(3), upper: { mid: 7, name: 'Contributor', face: '' } }]
  mock.request.mockResolvedValue(response(original))
  mock.videoInfo.mockImplementation(async ({ bvid }) => bvid === 'BV2'
    ? { code: 0, data: { owner: { mid: 1, face: '//i0.hdslb.com/face.png' } } }
    : { code: 0, data: { owner: { mid: 9, face: 'https://i0.hdslb.com/other.png' } } })
  const feed = useFavoriteSeason(() => '1')

  await feed.open(9)
  expect(mock.videoInfo).toHaveBeenCalledTimes(2)
  expect(feed.content.value?.items.map(item => item.upper.face)).toEqual(['', 'https://i0.hdslb.com/face.png', 'https://i0.hdslb.com/face.png'])
  feed.clear()
  mock.videoInfo.mockClear()
  await feed.open(9)
  expect(mock.videoInfo.mock.calls.map(([query]) => query.bvid)).toEqual(['BV3'])
  expect(readFavoriteSeasonSnapshot(mock.stored, '1:9')?.content.items[1].upper.face).toBe('https://i0.hdslb.com/face.png')
})

it('publishes additions, removals and updated video metadata after the full refresh', async () => {
  seed('1:9', [video(2), video(1)])
  const server = deferred<FavoriteSeasonResult>()
  mock.request.mockReturnValue(server.promise)
  const feed = useFavoriteSeason(() => '1')

  const refresh = feed.open(9)
  await vi.waitFor(() => expect(feed.content.value?.items.map(item => item.id)).toEqual([2, 1]))
  server.resolve(response([{ ...video(1), title: 'Updated' }, video(3)]))
  await refresh

  const updated = feed.content.value?.items
  expect(updated?.map(item => [item.id, item.title])).toEqual([[3, 'Video 3'], [1, 'Updated']])
  expect(readFavoriteSeasonSnapshot(mock.stored, '1:9')?.content.items).toEqual(updated)
})

it('keeps a complete cached list when a later page fails or repeats', async () => {
  const old = seed('1:9', [video(1)])
  const page = Array.from({ length: 20 }, (_, i) => video(i + 1))
  mock.request
    .mockResolvedValueOnce(response(page, 21))
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce(response(page, 21))
    .mockResolvedValueOnce(response([page[0]], 21))
  const feed = useFavoriteSeason(() => '1')

  await feed.open(9)
  expect(feed.loadFailed.value).toBe(true)
  expect(feed.content.value).toEqual(old)
  await feed.refresh()
  expect(feed.loadFailed.value).toBe(true)
  expect(feed.content.value).toEqual(old)
  expect(mock.send).not.toHaveBeenCalled()
})

it('stores a previous selection in the background without replacing the currently open collection', async () => {
  const previous = deferred<FavoriteSeasonResult>()
  mock.request.mockReturnValueOnce(previous.promise).mockResolvedValueOnce(response([video(2)]))
  const feed = useFavoriteSeason(() => '1')

  const first = feed.open(9)
  await vi.waitFor(() => expect(mock.request).toHaveBeenCalledTimes(1))
  expect(feed.isLoading.value).toBe(true)
  expect(feed.content.value).toBeUndefined()
  await feed.open(10)
  previous.resolve(response([video(1)]))
  await first

  expect(feed.content.value?.items).toEqual([video(2)])
  expect(readFavoriteSeasonSnapshot(mock.stored, '1:9')?.content.items).toEqual([video(1)])
})

it('scopes snapshots to the signed-in account and rejects older overlapping results', async () => {
  const content = seed('1:9', [video(1)])
  const background = deferred<FavoriteSeasonResult>()
  let account = '2'
  mock.request.mockReturnValue(background.promise)
  const feed = useFavoriteSeason(() => account)

  const result = feed.open(9)
  await vi.waitFor(() => expect(mock.request).toHaveBeenCalledTimes(1))
  expect(feed.content.value).toBeUndefined()
  account = '3'
  background.resolve(response([video(2)]))
  await result
  expect(mock.send).not.toHaveBeenCalled()
  expect(updateFavoriteSeasonCache(mock.stored, { key: '1:9', snapshot: { startedAt: 0, checkedAt: 3, content } })).toBeUndefined()
})
