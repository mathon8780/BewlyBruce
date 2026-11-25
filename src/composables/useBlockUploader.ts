import { useI18n } from 'vue-i18n'
import { POSITION, useToast } from 'vue-toastification'

import BlockedUploaderToast from '~/components/VideoCard/BlockedUploaderToast.vue'
import { updateBlockedUploader } from '~/logic/blockedUploaders'
import { normalizeUploaderMid } from '~/utils/blockedUploaders'

export function useBlockUploader() {
  const { t } = useI18n()
  const toast = useToast()

  return async (mid: unknown, name = '', avatar?: string) => {
    const id = normalizeUploaderMid(mid)
    if (!id)
      return
    try {
      if (await updateBlockedUploader(id, name, avatar)) {
        toast.success({
          component: BlockedUploaderToast,
          props: {
            message: t('video_card.uploader_blocked', { name: name || `UID ${id}` }),
            undoLabel: t('common.undo'),
            closeLabel: t('common.close'),
            async undo() {
              try {
                await updateBlockedUploader(id, null)
                return true
              }
              catch {
                toast.error(t('common.operation_failed'))
                return false
              }
            },
          },
        }, {
          position: POSITION.BOTTOM_RIGHT,
          toastClassName: 'bewly-blocked-uploader-toast',
          bodyClassName: 'bewly-blocked-uploader-toast-body',
          icon: false,
          closeButton: false,
          closeOnClick: false,
          draggable: false,
          timeout: 7000,
          pauseOnHover: false,
          pauseOnFocusLoss: false,
        })
      }
    }
    catch {
      toast.error(t('common.operation_failed'))
    }
  }
}
