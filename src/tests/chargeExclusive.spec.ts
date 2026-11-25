import { afterEach, expect, it, vi } from 'vitest'

import { startChargeExclusiveFilter } from '~/contentScripts/chargeExclusiveFilter'
import { originalSettings, parseSettings } from '~/logic/settings'
import { isChargeExclusive } from '~/utils/chargeExclusive'

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

it('uses explicit charge information and makes limited-time free labels take precedence', () => {
  expect(originalSettings.blockChargeExclusive).toBe(false)
  expect(parseSettings({ blockChargeExclusive: true }).blockChargeExclusive).toBe(true)
  expect(isChargeExclusive({ charging_pay: { level: 20 } })).toBe(true)
  expect(isChargeExclusive({ is_upower_exclusive: true, is_upower_preview: true })).toBe(true)
  expect(isChargeExclusive({ badge: { text: '充電專屬' } })).toBe(true)
  expect(isChargeExclusive({ charging_pay: { level: 20 }, badges: [{ text: '充电专属' }, { text: '限时免费' }] })).toBe(false)
  expect(isChargeExclusive({ title: '如何投稿充电专属视频', rights: { elec: 1 } })).toBe(false)
})

it('uses native list badges and keeps favorite pages exempt across navigation', () => {
  const navigate = (url: string) => vi.stubGlobal('location', new URL(url))
  navigate('https://www.bilibili.com/list/watchlater')
  document.body.innerHTML = '<article class="action-list-item" id="locked"><span class="tag">充电专属</span></article><article class="action-list-item" id="free"><span class="tag">充电专属</span><span class="tag">限时免费</span></article>'
  const stop = startChargeExclusiveFilter()
  const locked = document.getElementById('locked')!
  const free = document.getElementById('free')!
  try {
    expect(locked.hasAttribute('data-bewly-hide-charge-exclusive')).toBe(true)
    expect(free.hasAttribute('data-bewly-hide-charge-exclusive')).toBe(false)
    navigate('https://space.bilibili.com/123/favlist')
    window.dispatchEvent(new Event('historyChange'))
    expect(locked.hasAttribute('data-bewly-hide-charge-exclusive')).toBe(false)
  }
  finally {
    stop()
  }
})
