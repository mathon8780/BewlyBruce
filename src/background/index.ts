import browser from 'webextension-polyfill'

import { setupApiMsgLstnrs } from './messageListeners/api'
import { setupStorageMessages } from './messageListeners/storage'
import { setupTabMsgLstnrs } from './messageListeners/tabs'

browser.runtime.onInstalled.addListener(async () => {
  // eslint-disable-next-line no-console
  console.log('Extension installed')
})

// eslint-disable-next-line node/prefer-global/process
if (process.env.FIREFOX) {
  browser.webRequest.onBeforeSendHeaders.addListener(
    ({ documentUrl, originUrl, requestHeaders = [] }) => {
      const source = documentUrl || originUrl
      if (!source?.startsWith(browser.runtime.getURL('')))
        return

      const containerCookie = requestHeaders.find(header => header.name.toLowerCase() === 'firefox-multi-account-cookie')
      const headers = requestHeaders.filter(header => !containerCookie || header.name.toLowerCase() !== 'cookie')
      for (const header of headers) {
        switch (header.name.toLowerCase()) {
          case 'origin':
          case 'referer':
            header.value = 'https://www.bilibili.com'
            break
          case 'firefox-multi-account-cookie':
            header.name = 'Cookie'
            break
        }
      }
      return { requestHeaders: headers }
    },
    { urls: ['*://*.bilibili.com/*'], types: ['xmlhttprequest'] },
    ['blocking', 'requestHeaders'],
  )
}

// Setup all message listeners
setupApiMsgLstnrs()
setupTabMsgLstnrs()
setupStorageMessages()
