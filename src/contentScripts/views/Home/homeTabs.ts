import { HomeSubPage } from './types'

export interface HomeTab {
  i18nKey: string
  page: HomeSubPage
}

export interface HomeTabVisibility {
  page: HomeSubPage
  visible: boolean
}

export const homeTabs: readonly HomeTab[] = [
  {
    i18nKey: 'home.for_you',
    page: HomeSubPage.ForYou,
  },
  {
    i18nKey: 'home.following',
    page: HomeSubPage.Following,
  },
  {
    i18nKey: 'home.subscribed_series',
    page: HomeSubPage.SubscribedSeries,
  },
  {
    i18nKey: 'home.trending',
    page: HomeSubPage.Trending,
  },
  {
    i18nKey: 'home.ranking',
    page: HomeSubPage.Ranking,
  },
  {
    i18nKey: 'home.live',
    page: HomeSubPage.Live,
  },
]
const knownPages = new Set(homeTabs.map(tab => tab.page))

export function resolveHomeTabVisibility(config: readonly HomeTabVisibility[]): HomeTabVisibility[] {
  const saved = new Map<HomeSubPage, boolean>()
  for (const { page, visible } of config) {
    if (knownPages.has(page))
      saved.set(page, visible)
  }
  const defaultsVisible = !saved.size
  for (const { page } of homeTabs) {
    if (!saved.has(page))
      saved.set(page, defaultsVisible)
  }
  const tabs = Array.from(saved, ([page, visible]) => ({ page, visible }))
  if (!tabs.some(tab => tab.visible))
    tabs[0].visible = true
  return tabs
}
