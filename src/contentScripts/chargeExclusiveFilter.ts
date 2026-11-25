import { hasChargeLabel } from '~/utils/chargeExclusive'

const cardSelector = [
  '.bili-video-card',
  '.video-page-card-small',
  '.video-page-operator-card-small',
  '.recommend-video-card',
  '.popular-video-container .video-card',
  '.rank-item',
  '.action-list-item',
  '.bili-dyn-card-video',
  '.small-item',
  '.history-record',
].join(', ')
const badgeSelector = [
  '.tag',
  '.badge',
  '[class*="__badge"]',
  '[class*="__tag"]',
  '[class*="__type-label"]',
  '[class*="cover-badge"]',
  '[class*="cover-tag"]',
  '[class*="video-badge"]',
  '[class*="video-tag"]',
].join(', ')
const hiddenAttribute = 'data-bewly-hide-charge-exclusive'

export function isChargeFilterPage(url: URL) {
  if (url.hostname === 'space.bilibili.com')
    return !/^\/\d+\/favlist(?:\/|$)/.test(url.pathname)
  if (url.hostname === 'search.bilibili.com' || url.hostname === 't.bilibili.com')
    return true
  return url.hostname === 'www.bilibili.com'
    && !/^\/list\/ml\d+/.test(url.pathname)
}

export function startChargeExclusiveFilter() {
  const style = document.createElement('style')
  style.textContent = `[${hiddenAttribute}], .feed-card:has(> [${hiddenAttribute}]) { display: none !important; }`
  const pending = new Set<Element>()
  let frame = 0

  function updateCard(card: Element) {
    const badges = Array.from(card.querySelectorAll(badgeSelector))
      .filter(badge => badge.closest(cardSelector) === card)
    const labels = badges.map(badge => (badge.textContent ?? '').trim()).filter(text => text.length <= 40)
    card.toggleAttribute(hiddenAttribute, hasChargeLabel(labels))
  }

  function collect(node: Node, includeChildren: boolean) {
    const element = node instanceof Element ? node : node.parentElement
    if (!element)
      return
    const card = element.closest(cardSelector)
    if (card)
      pending.add(card)
    if (includeChildren)
      element.querySelectorAll(cardSelector).forEach(card => pending.add(card))
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      collect(record.target, false)
      record.addedNodes.forEach(node => collect(node, node instanceof Element))
    }
    if (pending.size && !frame) {
      frame = requestAnimationFrame(() => {
        frame = 0
        for (const card of pending) {
          if (card.isConnected)
            updateCard(card)
        }
        pending.clear()
      })
    }
  })

  function clearHiddenCards() {
    style.remove()
    document.querySelectorAll(`[${hiddenAttribute}]`).forEach(card => card.removeAttribute(hiddenAttribute))
  }

  function refresh() {
    observer.disconnect()
    cancelAnimationFrame(frame)
    frame = 0
    pending.clear()
    if (!isChargeFilterPage(new URL(location.href))) {
      clearHiddenCards()
      return
    }
    if (!style.isConnected)
      document.documentElement.append(style)
    document.querySelectorAll(cardSelector).forEach(updateCard)
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true })
  }

  for (const event of ['historyChange', 'popstate'])
    window.addEventListener(event, refresh)
  refresh()
  return () => {
    for (const event of ['historyChange', 'popstate'])
      window.removeEventListener(event, refresh)
    observer.disconnect()
    cancelAnimationFrame(frame)
    clearHiddenCards()
  }
}
