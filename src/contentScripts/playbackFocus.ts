import styles from '~/styles/playbackFocus.css?raw'

import { getPageType } from './pageScope'

export interface PlaybackFocusOptions {
  blockRelatedVideos: boolean
  blockAdsAndPromotions: boolean
}

const autoplayToggle = '.continuous-btn:has(.switch-btn.on)'
const pauseAfterVideo = '.bpx-player-ctrl-setting-handoff input.bui-radio-input[value="2"]'
const autoplayControls = '.continuous-btn, .bpx-player-ctrl-setting-handoff'

export function startPlaybackFocus(initial: PlaybackFocusOptions) {
  let options = { ...initial }
  let disposed = false
  const style = document.createElement('style')
  style.dataset.bewlyPlaybackFocus = ''
  style.textContent = styles
  let autoplayObserver: MutationObserver | undefined

  function turnOffAutoplay() {
    document.querySelector<HTMLElement>(autoplayToggle)?.click()
    document.querySelectorAll<HTMLInputElement>(pauseAfterVideo).forEach((input) => {
      if (!input.checked && !input.disabled)
        input.click()
    })
  }

  function handleAutoplayChange(event: Event) {
    if (event.target instanceof Element && event.target.closest(autoplayControls))
      queueMicrotask(() => autoplayObserver && turnOffAutoplay())
  }

  function watchAutoplay(block: boolean) {
    if (!block) {
      autoplayObserver?.disconnect()
      autoplayObserver = undefined
      document.removeEventListener('change', handleAutoplayChange, true)
      return
    }
    if (!autoplayObserver) {
      autoplayObserver = new MutationObserver((records) => {
        if (records.some(record =>
          (record.target instanceof Element && record.target.closest(autoplayControls))
          || [...record.addedNodes].some(node => node instanceof Element
            && (node.matches(autoplayControls) || node.querySelector(autoplayControls))),
        )) {
          turnOffAutoplay()
        }
      })
      autoplayObserver.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'checked'],
      })
      document.addEventListener('change', handleAutoplayChange, true)
    }
    turnOffAutoplay()
  }

  function refresh() {
    const url = new URL(location.href)
    const page = getPageType(url.href)
    const playback = page === 'videoPage' || page === 'animePlayback&MoviePage'
      || (page === 'watchLaterPage' && /^\/watchlater\/list(?:\/|$)/.test(url.pathname))
    const root = document.documentElement
    root.toggleAttribute('data-bewly-hide-recommendations', playback && options.blockRelatedVideos)
    root.toggleAttribute('data-bewly-hide-activities', playback && options.blockAdsAndPromotions)
    root.toggleAttribute('data-bewly-hide-search-promotions', page === 'searchPage' && options.blockAdsAndPromotions)
    watchAutoplay(playback && options.blockRelatedVideos)
  }

  function stop() {
    window.removeEventListener('historyChange', refresh)
    window.removeEventListener('popstate', refresh)
    window.removeEventListener('hashchange', refresh)
    document.documentElement.removeAttribute('data-bewly-hide-recommendations')
    document.documentElement.removeAttribute('data-bewly-hide-activities')
    document.documentElement.removeAttribute('data-bewly-hide-search-promotions')
    document.documentElement.classList.remove('block-useless-contents')
    watchAutoplay(false)
    style.remove()
  }

  function sync(next: PlaybackFocusOptions) {
    options = { ...next }
    if (!options.blockRelatedVideos && !options.blockAdsAndPromotions) {
      stop()
      return
    }
    document.documentElement.classList.toggle('block-useless-contents', options.blockAdsAndPromotions)
    if (!style.isConnected) {
      document.documentElement.append(style)
      window.addEventListener('historyChange', refresh)
      window.addEventListener('popstate', refresh)
      window.addEventListener('hashchange', refresh)
    }
    refresh()
  }

  sync(initial)
  return {
    update(options: PlaybackFocusOptions) {
      if (!disposed)
        sync(options)
    },
    dispose() {
      disposed = true
      stop()
    },
  }
}
