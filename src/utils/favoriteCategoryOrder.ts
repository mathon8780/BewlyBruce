export interface FavoriteCategoryOrderUpdate {
  account: string
  keys: string[]
  mode: 'sync' | 'reorder'
}

const keyPattern = /^(?:11|21):[1-9]\d*$/

export function favoriteCategoryOrderKey(account: string) {
  return `favoriteCategoryOrder:${account}`
}

function validKeys(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((key): key is string => typeof key === 'string' && keyPattern.test(key)))]
    : []
}

export function updateFavoriteCategoryOrder(previous: unknown, update: FavoriteCategoryOrderUpdate) {
  const known = validKeys(previous)
  const current = validKeys(update.keys)
  if (update.mode === 'reorder') {
    const visible = new Set(current)
    return [...current, ...known.filter(key => !visible.has(key))]
  }
  const remaining = new Set(current)
  return [...known.filter(key => remaining.delete(key)), ...remaining]
}

export function orderFavoriteCategories<T>(items: T[], keys: string[], getKey: (item: T) => string) {
  const byKey = new Map(items.map(item => [getKey(item), item]))
  const ordered: T[] = []
  for (const key of keys) {
    const item = byKey.get(key)
    if (item !== undefined) {
      ordered.push(item)
      byKey.delete(key)
    }
  }
  return [...ordered, ...byKey.values()]
}
