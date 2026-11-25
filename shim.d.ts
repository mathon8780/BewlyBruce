import type { AttributifyAttributes } from '@unocss/preset-attributify'
import type { Composer } from 'vue-i18n'

declare module '@vue/runtime-dom' {
  interface HTMLAttributes extends AttributifyAttributes {}
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $t: Composer['t']
  }
}
