import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'

import SearchBar from '~/components/SearchBar/SearchBar.vue'
import { useTopBarData } from '~/components/TopBar/useTopBarData'
import VirtualFeed from '~/components/VirtualFeed.vue'

const mocks = vi.hoisted(() => ({
  getHistory: vi.fn(),
  removeHistory: vi.fn(),
  getUnreadMsg: vi.fn(),
  getUnreadDm: vi.fn(),
  initializePoll: vi.fn(),
}))

vi.mock('~/logic', async () => {
  const { ref } = await import('vue')
  const { originalSettings } = await import('~/logic/settings')
  return { settings: ref(structuredClone(originalSettings)) }
})
vi.mock('~/components/SearchBar/searchHistoryProvider', () => ({
  getSearchHistory: mocks.getHistory,
  removeSearchHistory: mocks.removeHistory,
  addSearchHistory: vi.fn(),
  clearAllSearchHistory: vi.fn(),
}))
vi.mock('~/utils/api', () => ({
  default: {
    user: { getUserInfo: async () => ({ code: 0, data: {} }) },
    notification: { getUnreadMsg: mocks.getUnreadMsg, getUnreadDm: mocks.getUnreadDm },
  },
}))
vi.mock('~/components/TopBar/useTopBarPolling', () => ({
  useTopBarPolling(initialize: () => Promise<void>) {
    mocks.initializePoll(initialize)
    return { isActive: () => true, isAlive: () => true }
  },
}))
vi.mock('vue-toastification', () => ({ useToast: () => ({ error: vi.fn() }) }))

const scrollbarRef = shallowRef<{ osInstance: () => { elements: () => { viewport: HTMLElement } } }>()
vi.mock('~/composables/useAppProvider', () => ({ useBewlyApp: () => ({ scrollbarRef }) }))
let app: App | undefined

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  app?.unmount()
  app = undefined
  scrollbarRef.value = undefined
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

async function settle() {
  for (let tick = 0; tick < 12; tick++)
    await nextTick()
}

it('remeasures retained virtual rows after the first item changes', async () => {
  class StableRowObserver {
    private targets = new Set<Element>()
    constructor(private readonly notify: ResizeObserverCallback) {}

    observe(target: Element) {
      if (this.targets.has(target))
        return
      this.targets.add(target)
      queueMicrotask(() => {
        if (this.targets.has(target)) {
          const size = { inlineSize: 800, blockSize: 120 }
          this.notify(
            [{
              target,
              contentRect: new DOMRect(0, 0, 800, 120),
              borderBoxSize: [size],
              contentBoxSize: [size],
              devicePixelContentBoxSize: [size],
            }],
            this,
          )
        }
      })
    }

    unobserve(target: Element) {
      this.targets.delete(target)
    }

    disconnect() {
      this.targets.clear()
    }
  }
  vi.stubGlobal('ResizeObserver', StableRowObserver)
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const viewport = document.createElement('div')
  Object.defineProperty(viewport, 'clientHeight', { value: 300 })
  scrollbarRef.value = { osInstance: () => ({ elements: () => ({ viewport }) }) }
  const items = shallowRef(Array.from({ length: 30 }, (_, id) => id))
  app = createApp({
    render: () => h(VirtualFeed<number>, { items: items.value, itemKey: item => item }, { default: ({ item }: { item: number }) => h('p', String(item)) }),
  })
  const target = document.body.appendChild(document.createElement('main'))
  app.mount(target)
  await settle()
  const root = target.firstElementChild!
  function estimatedHeight() {
    const spacer = root.lastElementChild as HTMLElement
    return Number.parseInt(spacer.style.height, 10) + root.querySelectorAll('[data-feed-row]').length * 120
  }
  expect(estimatedHeight()).toBe(3600)

  items.value = [-1, ...items.value.slice(1)]
  await settle()
  expect(estimatedHeight()).toBe(3600)
})

it('keeps a confirmed search-history deletion when the input is focused again', async () => {
  const removed = { value: 'Removed result', timestamp: 1 }
  mocks.getHistory.mockResolvedValue([removed])
  let confirmDeletion!: (items: typeof removed[]) => void
  mocks.removeHistory.mockImplementation(() => new Promise(resolve => (confirmDeletion = resolve)))
  app = createApp(SearchBar).use(createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false }))
  const target = document.body.appendChild(document.createElement('main'))
  app.mount(target)
  const input = target.querySelector('input')!
  input.dispatchEvent(new FocusEvent('focus'))
  await settle()
  target.querySelector<HTMLButtonElement>('.history-item button')!.click()
  expect(mocks.removeHistory).toHaveBeenCalledExactlyOnceWith(removed.value)

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await nextTick()
  input.dispatchEvent(new FocusEvent('focus'))
  await settle()
  expect(mocks.getHistory).toHaveBeenCalledOnce()
  confirmDeletion([])
  await vi.waitFor(() => expect(target.querySelector('.history-item')).toBeNull())
})

it('refreshes successful unread counts while preserving an unavailable source', async () => {
  const data = useTopBarData()
  await mocks.initializePoll.mock.calls[0][0]()
  mocks.getUnreadMsg.mockResolvedValueOnce({ code: 0, data: { reply: 4, up: 12 } })
  mocks.getUnreadDm.mockResolvedValueOnce({ code: -403 })
  await data.getUnreadMessageCount()
  expect(data.unReadMessageCount.value).toBe(4)

  mocks.getUnreadMsg.mockRejectedValueOnce(new Error('offline'))
  mocks.getUnreadDm.mockResolvedValueOnce({ code: 0, data: { follow_unread: 2 } })
  await data.getUnreadMessageCount()
  expect(data.unReadMessageCount.value).toBe(6)
})
