import browser from 'webextension-polyfill'

import { SEARCH_HISTORY_WRITE_PORT } from '~/constants/globalEvents'

const SEARCH_HISTORY_LIMIT = 20
const bridgeOrigin = 'https://s1.hdslb.com'
const bridgePath = '/bfs/seed/jinkela/short/cols/iframe.html'
const historyKey = 'search_history:search_history'

export interface HistoryItem {
  value: string
  timestamp: number
}
export interface SuggestionItem {
  value: string
  term: string
  name: string
  type: string
  ref: number
  spid: number
  timestamp: number
}
export interface SuggestionResponse {
  code: number
  exp_str: string
  result: {
    tag: SuggestionItem[]
  }
  stoken: string
}

interface StorageResponse {
  type: 'COLS_RES'
  id: string
  key: string
  value?: string | null
}

function bridgeRequest(target: Window, signal: AbortSignal, type: 'COLS_GET' | 'COLS_SET' | 'COLS_RM', value?: string) {
  signal.throwIfAborted()
  const id = crypto.randomUUID()
  return new Promise<StorageResponse>((resolve, reject) => {
    function cleanup() {
      window.removeEventListener('message', receive)
      signal.removeEventListener('abort', abort)
    }
    function receive(event: MessageEvent<StorageResponse>) {
      if (event.origin === bridgeOrigin && event.source === target && event.data?.type === 'COLS_RES'
        && event.data.id === id && event.data.key === historyKey) {
        cleanup()
        resolve(event.data)
      }
    }
    function abort() {
      cleanup()
      reject(signal.reason)
    }
    window.addEventListener('message', receive)
    signal.addEventListener('abort', abort, { once: true })
    try {
      target.postMessage({ type, id, key: historyKey, value }, bridgeOrigin)
    }
    catch (error) {
      cleanup()
      reject(error)
    }
  })
}

async function withBridge<T>(signal: AbortSignal, action: (target: Window) => Promise<T>): Promise<T> {
  signal.throwIfAborted()
  const existing = Array.from(document.getElementsByTagName('iframe')).find((frame) => {
    const url = new URL(frame.src || 'about:blank')
    return url.origin === bridgeOrigin && url.pathname === bridgePath && frame.contentWindow
  })
  if (existing?.contentWindow)
    return action(existing.contentWindow)

  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.src = bridgeOrigin + bridgePath
  try {
    await new Promise<void>((resolve, reject) => {
      frame.addEventListener('load', () => resolve(), { once: true, signal })
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      document.body.appendChild(frame)
    })
    if (!frame.contentWindow)
      throw new Error('Search history frame unavailable')
    return await action(frame.contentWindow)
  }
  finally {
    frame.remove()
  }
}

async function readHistory(target: Window, signal: AbortSignal): Promise<HistoryItem[]> {
  const { value } = await bridgeRequest(target, signal, 'COLS_GET')
  if (value === null)
    return []
  if (typeof value !== 'string')
    throw new Error('Search history read failed')
  const items: unknown = JSON.parse(value)
  return Array.isArray(items)
    ? items.filter(item => typeof item?.value === 'string' && Number.isFinite(item?.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, SEARCH_HISTORY_LIMIT)
    : []
}

export function getSearchHistory() {
  const signal = AbortSignal.timeout(2000)
  return withBridge(signal, target => readHistory(target, signal))
}

async function updateHistory(update: (items: HistoryItem[]) => HistoryItem[], clear = false) {
  const port = browser.runtime.connect({ name: SEARCH_HISTORY_WRITE_PORT })
  const controller = new AbortController()
  const { signal } = controller
  const timer = setTimeout(() => controller.abort(new Error('Search history timed out')), 3500)
  const disconnect = () => controller.abort(new Error('Search history connection closed'))
  port.onDisconnect.addListener(disconnect)
  try {
    await new Promise<void>((resolve, reject) => {
      port.onMessage.addListener((granted) => {
        if (granted === true)
          resolve()
      })
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
    return await withBridge(signal, async (target) => {
      const items = clear ? [] : update(await readHistory(target, signal))
      await bridgeRequest(target, signal, clear ? 'COLS_RM' : 'COLS_SET', JSON.stringify(items))
      // 原站成功和异常都返回确认消息，需要读回结果。
      const stored = await readHistory(target, signal)
      if (JSON.stringify(stored) !== JSON.stringify(items))
        throw new Error('Search history write could not be verified')
      return stored
    })
  }
  finally {
    clearTimeout(timer)
    port.onDisconnect.removeListener(disconnect)
    port.disconnect()
  }
}

export function addSearchHistory(item: HistoryItem) {
  return updateHistory(items => [item, ...items.filter(entry => entry.value !== item.value)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, SEARCH_HISTORY_LIMIT))
}

export function removeSearchHistory(value: string) {
  return updateHistory(items => items.filter(item => item.value !== value))
}

export function clearAllSearchHistory() {
  return updateHistory(() => [], true)
}
