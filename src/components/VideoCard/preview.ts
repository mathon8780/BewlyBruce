import type { VideoInfo } from '~/models/video/videoInfo'
import type { VideoPreviewResult } from '~/models/video/videoPreview'
import api from '~/utils/api'
import { createInflightRequests } from '~/utils/inflightRequest'

const pendingPreview = createInflightRequests()

export function getPreviewSources(
  video: { aid?: number, bvid?: string, cid?: number },
  consumer?: AbortSignal,
): Promise<string[]> {
  return pendingPreview(
    `${video.bvid || video.aid}:${video.cid || ''}`,
    async (signal) => {
      let cid = video.cid
      let bvid = video.bvid
      if (!cid || !bvid) {
        const info: VideoInfo = await api.video.getVideoInfo(
          { bvid, aid: video.aid ? String(video.aid) : undefined },
          { signal },
        )
        if (info.code !== 0)
          throw new Error(info.message)
        cid = info.data.cid
        bvid = info.data.bvid
      }
      if (signal.aborted)
        throw new Error('Preview request expired')
      const result: VideoPreviewResult = await api.video.getVideoPreview({ bvid, cid }, { signal })
      const segment = result.data?.durl?.[0]
      if (result.code !== 0 || !segment)
        throw new Error(result.message)
      const urls = [segment.url, ...(segment.backup_url ?? [])].filter(Boolean)
      if (!urls.length)
        throw new Error('Preview has no playable sources')
      return [...new Set(urls)]
    },
    consumer,
  )
}
