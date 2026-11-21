import type Browser from 'webextension-polyfill'
import browser from 'webextension-polyfill'

import { SEARCH_HISTORY_WRITE_PORT } from '~/constants/globalEvents'

export function setupSearchHistoryMessages() {
  const queue = new Set<Browser.Runtime.Port>()
  let active: Browser.Runtime.Port | undefined

  function grantNext() {
    if (active)
      return
    for (const port of queue) {
      try {
        port.postMessage(true)
        active = port
        return
      }
      catch {
        queue.delete(port)
      }
    }
  }

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== SEARCH_HISTORY_WRITE_PORT)
      return
    queue.add(port)
    let expiry: ReturnType<typeof setTimeout>
    const release = () => {
      clearTimeout(expiry)
      queue.delete(port)
      if (active === port)
        active = undefined
      grantNext()
    }
    expiry = setTimeout(() => {
      try {
        port.disconnect()
      }
      finally {
        release()
      }
    }, 8000)
    port.onDisconnect.addListener(release)
    grantNext()
  })
}
