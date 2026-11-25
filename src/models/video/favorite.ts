export interface FavoritesResult {
  code: number
  message: string
  ttl: number
  data: Data
}

export interface Data {
  info: Info
  medias: Media[]
  has_more: boolean
  ttl: number
}

export interface Info {
  id: number
  fid: number
  mid: number
  attr: number
  title: string
  cover: string
  upper: InfoUpper
  cover_type: number
  cnt_info: InfoCntInfo
  type: number
  intro: string
  ctime: number
  mtime: number
  state: number
  fav_state: number
  like_state: number
  media_count: number
}

export interface InfoCntInfo {
  collect: number
  play: number
  thumb_up: number
  share: number
}

export interface InfoUpper {
  mid: number
  name: string
  face: string
  followed: boolean
  vip_type: number
  vip_statue: number
}

export interface Media {
  id: number
  type: number
  title: string
  cover: string
  intro: string
  page: number
  duration: number
  upper: MediaUpper
  attr: number
  cnt_info: MediaCntInfo
  link: string
  ctime: number
  pubtime: number
  fav_time: number
  bv_id: string
  bvid: string
  season: null
  ogv: null
  ugc: Ugc
}

export interface MediaCntInfo {
  collect: number
  play: number
  danmaku: number
  vt: number
  play_switch: number
  reply: number
  view_text_1: string
}

export interface Ugc {
  first_cid: number
}

export interface MediaUpper {
  mid: number
  name: string
  face: string
}

export interface CollectedCategory {
  id: number
  mid: number
  type: number
  title: string
  cover: string
  media_count: number
}

export interface CollectedFoldersResult {
  code: number
  message: string
  data?: { list: CollectedCategory[] | null, has_more: boolean }
}

export type FavoriteSeasonVideo = Pick<Media, 'id' | 'title' | 'cover' | 'duration' | 'pubtime' | 'bvid' | 'upper'> & {
  cnt_info: Pick<MediaCntInfo, 'play' | 'danmaku'>
}

export interface FavoriteSeasonResult {
  code: number
  message: string
  data?: {
    info: Pick<Info, 'title' | 'cover' | 'media_count'>
    medias: FavoriteSeasonVideo[] | null
  }
}
