import type { FavoriteSeasonResult, FavoriteSeasonVideo } from '~/models/video/favorite'

import { normalizeUploaderAvatar } from './blockedUploaders'

const PAGE_SIZE = 20
export const FAVORITE_SEASON_CACHE_KEY = 'favoriteSeasonSnapshots'
const CACHE_BYTES = 2 * 1024 * 1024

export interface FavoriteSeasonContent {
  title: string
  cover: string
  count: number
  items: FavoriteSeasonVideo[]
}

export interface FavoriteSeasonSnapshot {
  startedAt: number
  checkedAt: number
  content: FavoriteSeasonContent
}

export interface FavoriteSeasonCacheUpdate {
  key: string
  snapshot: FavoriteSeasonSnapshot
}

type SeasonRequest = (params: { season_id: number, pn: number, ps: number }) => Promise<FavoriteSeasonResult>

function numberOrZero(value: number | undefined) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function normalizeVideo(video: FavoriteSeasonVideo): FavoriteSeasonVideo {
  return {
    id: video.id,
    bvid: video.bvid || '',
    title: video.title || '',
    cover: video.cover || '',
    duration: numberOrZero(video.duration),
    pubtime: numberOrZero(video.pubtime),
    upper: {
      mid: numberOrZero(video.upper?.mid),
      name: video.upper?.name || '',
      face: video.upper?.face || '',
    },
    cnt_info: {
      play: numberOrZero(video.cnt_info?.play),
      danmaku: numberOrZero(video.cnt_info?.danmaku),
    },
  }
}

export async function fetchFavoriteSeason(request: SeasonRequest, seasonId: number, sameAccount: () => boolean): Promise<FavoriteSeasonContent> {
  const videos = new Map<string, FavoriteSeasonVideo>()
  let metadata: Omit<FavoriteSeasonContent, 'items'> | undefined
  for (let page = 1; sameAccount(); page++) {
    const response = await request({ season_id: seasonId, pn: page, ps: PAGE_SIZE })
    if (!sameAccount())
      break
    const data = response.data
    if (response.code !== 0 || !data)
      throw new Error(response.message)
    const { info, medias } = data
    const count = info.media_count
    if (!Number.isSafeInteger(count) || count < 0 || (metadata && metadata.count !== count))
      throw new Error('Favorite season count changed during pagination')
    metadata ??= { title: info.title || '', cover: info.cover || '', count }
    const batch = medias ?? []
    // B 站也可能在第一页直接返回合集的全部视频。
    const completeBatch = page === 1 && batch.length >= count
    for (const video of batch) {
      if (!Number.isSafeInteger(video.id) || video.id <= 0)
        throw new Error('Invalid favorite season video ID')
      const key = video.bvid || String(video.id)
      if (videos.has(key) && !completeBatch)
        throw new Error('Favorite season pagination returned a duplicate video')
      videos.set(key, normalizeVideo(video))
    }
    if (completeBatch || page * PAGE_SIZE >= count) {
      if (count > 0 && !videos.size)
        throw new Error('Favorite season returned no videos')
      const items = [...videos.values()].sort((a, b) => b.pubtime - a.pubtime || a.id - b.id)
      return { ...metadata, items }
    }
  }
  throw new Error('Favorite season account changed during refresh')
}

export async function fillFavoriteSeasonAvatars(
  content: FavoriteSeasonContent,
  previous: FavoriteSeasonContent | undefined,
  resolve: (mid: number, bvid: string) => Promise<string | undefined>,
) {
  const avatars = new Map<number, string>()
  for (const video of [...(previous?.items ?? []), ...content.items]) {
    const avatar = normalizeUploaderAvatar(video.upper.face)
    if (video.upper.mid && avatar)
      avatars.set(video.upper.mid, avatar)
  }
  const missing = new Map<number, string>()
  for (const { upper, bvid } of content.items) {
    if (upper.mid && bvid && !avatars.has(upper.mid) && !missing.has(upper.mid))
      missing.set(upper.mid, bvid)
  }
  const remaining = missing.entries()
  await Promise.all(Array.from({ length: Math.min(missing.size, 3) }, async () => {
    for (const [mid, bvid] of remaining) {
      try {
        const avatar = normalizeUploaderAvatar(await resolve(mid, bvid))
        if (avatar)
          avatars.set(mid, avatar)
      }
      catch {
        // 头像请求失败时保留列表，卡片会显示默认头像。
      }
    }
  }))
  const items = content.items.map((video) => {
    const face = normalizeUploaderAvatar(video.upper.face) ?? avatars.get(video.upper.mid) ?? ''
    return face === video.upper.face ? video : { ...video, upper: { ...video.upper, face } }
  })
  return { ...content, items }
}

export function sameFavoriteSeason(a: FavoriteSeasonContent | undefined, b: FavoriteSeasonContent) {
  if (a === b)
    return true
  if (!a || a.title !== b.title || a.cover !== b.cover || a.count !== b.count || a.items.length !== b.items.length)
    return false
  return a.items.every((video, index) => {
    const other = b.items[index]
    return video.id === other.id && video.bvid === other.bvid && video.title === other.title
      && video.cover === other.cover && video.duration === other.duration && video.pubtime === other.pubtime
      && video.upper.mid === other.upper.mid && video.upper.name === other.upper.name && video.upper.face === other.upper.face
      && video.cnt_info.play === other.cnt_info.play && video.cnt_info.danmaku === other.cnt_info.danmaku
  })
}

function isSnapshot(value: unknown): value is FavoriteSeasonSnapshot {
  const snapshot = value as FavoriteSeasonSnapshot | undefined
  if (!snapshot?.content || !Number.isFinite(snapshot.startedAt) || !Number.isFinite(snapshot.checkedAt))
    return false
  const { content } = snapshot
  return content.count >= 0
    && typeof content.title === 'string' && typeof content.cover === 'string' && Number.isSafeInteger(content.count)
    && Array.isArray(content.items) && content.items.every(item => item && Number.isSafeInteger(item.id)
      && typeof item.title === 'string' && typeof item.bvid === 'string' && typeof item.cover === 'string'
      && Number.isFinite(item.pubtime) && Number.isFinite(item.duration)
      && Number.isSafeInteger(item.upper?.mid) && typeof item.upper.name === 'string' && typeof item.upper.face === 'string'
      && Number.isFinite(item.cnt_info?.play) && Number.isFinite(item.cnt_info.danmaku))
}

export function readFavoriteSeasonSnapshot(raw: unknown, key: string) {
  const value = (raw as Record<string, unknown> | undefined)?.[key]
  return isSnapshot(value) ? value : undefined
}

export function updateFavoriteSeasonCache(raw: unknown, update: FavoriteSeasonCacheUpdate) {
  const { key, snapshot } = update
  if (!/^\d+:\d+$/.test(key) || !isSnapshot(snapshot))
    return
  const previous = readFavoriteSeasonSnapshot(raw, key)
  if (previous && previous.startedAt > snapshot.startedAt)
    return

  const encoder = new TextEncoder()
  const entry = {
    ...snapshot,
    content: previous && sameFavoriteSeason(previous.content, snapshot.content) ? previous.content : snapshot.content,
  }
  const entryBytes = (key: string, value: FavoriteSeasonSnapshot) => encoder.encode(JSON.stringify({ [key]: value })).byteLength
  let bytes = entryBytes(key, entry)
  if (bytes > CACHE_BYTES)
    return

  const result: Record<string, FavoriteSeasonSnapshot> = { [key]: entry }
  const others = raw && typeof raw === 'object' ? Object.entries(raw) : []
  for (const [oldKey, value] of others
    .filter(([oldKey, value]) => oldKey !== key && /^\d+:\d+$/.test(oldKey) && isSnapshot(value))
    .sort(([, a], [, b]) => b.checkedAt - a.checkedAt)) {
    const size = entryBytes(oldKey, value)
    if (bytes + size <= CACHE_BYTES) {
      result[oldKey] = value
      bytes += size
    }
  }
  return result
}
