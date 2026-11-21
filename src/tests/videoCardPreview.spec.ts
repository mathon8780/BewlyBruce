import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ALink from '~/components/ALink.vue'
import Picture from '~/components/Picture.vue'
import VideoCard from '~/components/VideoCard/VideoCard.vue'

const { getVideoPreview, setActivatedCover } = vi.hoisted(() => ({
  getVideoPreview: vi.fn(),
  setActivatedCover: vi.fn(),
}))

vi.mock('~/logic', async () => {
  const { ref } = await import('vue')
  const { originalSettings } = await import('~/logic/settings')
  return { settings: ref(structuredClone(originalSettings)), accessKey: ref('') }
})
vi.mock('~/utils/api', () => ({ default: { video: { getVideoPreview } } }))
vi.mock('~/utils/authProvider', () => ({ getTvSign: vi.fn(), TVAppKey: '' }))
vi.mock('~/utils/tabs', () => ({ openLinkInBackground: vi.fn() }))
vi.mock('~/stores/mainStore', () => ({ useMainStore: () => ({ setActivatedCover }) }))
vi.mock('~/composables/useAppProvider', () => ({ useBewlyApp: () => ({ openIframeDrawer: vi.fn() }) }))
vi.mock('vue-toastification', () => ({ useToast: () => ({ error: vi.fn() }) }))

let app: App | undefined

beforeEach(() => {
  getVideoPreview.mockReset()
  setActivatedCover.mockReset()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.useFakeTimers()
})

afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function response(url: string, backups: string[] = []) {
  return { code: 0, data: { durl: [{ url, backup_url: backups }] } }
}

function mountCard() {
  app = createApp(VideoCard, {
    showPreview: true,
    showWatcherLater: false,
    moreBtn: false,
    video: { id: 1, bvid: 'BV1xx411c7mD', cid: 1, title: 'Preview', cover: '/cover.png', threePointV2: [] },
  })
  app.component('ALink', ALink)
  app.component('Picture', Picture)
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false }))
  app.mount(document.body.appendChild(document.createElement('div')))
  return document.querySelector<HTMLAnchorElement>('.video-card > a')!
}

function player(url: string) {
  return document.querySelector<HTMLVideoElement>(`video[src="${url}"]`)!
}

it('loops the inline preview and tries deduplicated backup sources during the same hover', async () => {
  getVideoPreview.mockResolvedValueOnce(response('/primary.mp4', ['/primary.mp4', '/backup.mp4']))
  const card = mountCard()
  card.dispatchEvent(new MouseEvent('mouseenter'))
  await vi.advanceTimersByTimeAsync(500)
  const primary = player('/primary.mp4')
  expect(primary.loop).toBe(true)
  expect(primary.playsInline).toBe(true)
  expect(primary.classList.contains('opacity-0')).toBe(true)
  primary.dispatchEvent(new Event('loadeddata'))
  await nextTick()
  expect(primary.classList.contains('opacity-0')).toBe(false)

  primary.dispatchEvent(new Event('error'))
  primary.dispatchEvent(new Event('error'))
  await nextTick()
  expect(player('/backup.mp4')).toBeTruthy()
  expect(getVideoPreview).toHaveBeenCalledOnce()
  expect(setActivatedCover).toHaveBeenCalledOnce()
})

it('refreshes expired sources only once per hover and stops when the pointer leaves', async () => {
  getVideoPreview.mockResolvedValueOnce(response('/expired.mp4')).mockResolvedValueOnce(response('/replacement.mp4'))
  const card = mountCard()
  card.dispatchEvent(new MouseEvent('mouseenter'))
  await vi.advanceTimersByTimeAsync(500)

  player('/expired.mp4').dispatchEvent(new Event('error'))
  await vi.advanceTimersByTimeAsync(0)
  expect(getVideoPreview).toHaveBeenCalledTimes(2)
  const replacement = player('/replacement.mp4')
  expect(replacement).toBeTruthy()
  replacement.dispatchEvent(new Event('error'))
  await vi.advanceTimersByTimeAsync(350)
  expect(document.querySelector('video')).toBeNull()
  expect(getVideoPreview).toHaveBeenCalledTimes(2)

  getVideoPreview.mockResolvedValueOnce(response('/next-hover.mp4'))
  card.dispatchEvent(new MouseEvent('mouseleave'))
  card.dispatchEvent(new MouseEvent('mouseenter'))
  await vi.advanceTimersByTimeAsync(500)
  expect(player('/next-hover.mp4')).toBeTruthy()
  card.dispatchEvent(new MouseEvent('mouseleave'))
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(350)
  expect(document.querySelector('video')).toBeNull()
})
