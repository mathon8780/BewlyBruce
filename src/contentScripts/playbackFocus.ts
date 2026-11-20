import styles from '~/styles/playbackFocus.css?raw'

import { getPageType } from './pageScope'

export interface PlaybackFocusOptions {
  blockRelatedVideos: boolean
  blockAdsAndPromotions: boolean
}

// 只用样式隐藏推荐和推广，不修改原站组件树，以免干扰初始化和评论懒加载。
export function startPlaybackFocus(initial: PlaybackFocusOptions) {
  let options = { ...initial }
  let disposed = false
  const style = document.createElement('style')
  style.dataset.bewlyPlaybackFocus = ''
  style.textContent = styles

  function refresh() {
    const url = new URL(location.href)
    const page = getPageType(url.href)
    const playback = page === 'videoPage' || page === 'animePlayback&MoviePage'
      || (page === 'watchLaterPage' && /^\/watchlater\/list(?:\/|$)/.test(url.pathname))
    const root = document.documentElement
    root.toggleAttribute('data-bewly-hide-recommendations', playback && options.blockRelatedVideos)
    root.toggleAttribute('data-bewly-hide-activities', playback && options.blockAdsAndPromotions)
    root.toggleAttribute('data-bewly-hide-search-promotions', page === 'searchPage' && options.blockAdsAndPromotions)
  }

  function stop() {
    window.removeEventListener('historyChange', refresh)
    window.removeEventListener('popstate', refresh)
    window.removeEventListener('hashchange', refresh)
    document.documentElement.removeAttribute('data-bewly-hide-recommendations')
    document.documentElement.removeAttribute('data-bewly-hide-activities')
    document.documentElement.removeAttribute('data-bewly-hide-search-promotions')
    document.documentElement.classList.remove('block-useless-contents')
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
