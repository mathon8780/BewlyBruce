import { expect, it } from 'vitest'

import { favoriteCategoryOrderKey, orderFavoriteCategories, updateFavoriteCategoryOrder } from '~/utils/favoriteCategoryOrder'

it('preserves the saved order, removes unfollowed entries and appends newly followed entries', () => {
  const previous = ['21:2', '21:1', '21:3']
  const current = ['21:4', '21:1', '21:2', '11:5', '11:5']
  const next = updateFavoriteCategoryOrder(previous, { account: '7', mode: 'sync', keys: current })
  expect(next).toEqual(['21:2', '21:1', '21:4', '11:5'])
  expect(orderFavoriteCategories(current.map(key => ({ key })), next, entry => entry.key).map(entry => entry.key)).toEqual(next)
  expect(favoriteCategoryOrderKey('7')).not.toBe(favoriteCategoryOrderKey('8'))
})

it('keeps an entry seen by another tab when a drag reorders a previously loaded list', () => {
  const next = updateFavoriteCategoryOrder(['21:1', '21:2', '21:3'], {
    account: '7',
    mode: 'reorder',
    keys: ['21:2', '21:1'],
  })
  expect(next).toEqual(['21:2', '21:1', '21:3'])
})
