import { isChargeExclusive } from '~/utils/chargeExclusive'

import { settings } from './storage'

export function shouldHideChargeExclusive(item: unknown) {
  return settings.value.blockChargeExclusive && isChargeExclusive(item)
}
