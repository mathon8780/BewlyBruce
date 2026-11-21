import type { UnwrapNestedRefs } from 'vue'

import api from '~/utils/api'

import { updateInterval } from './notify'
import type { UserInfo } from './types'
import { useTopBarPolling } from './useTopBarPolling'

export function useTopBarData() {
  const userInfo = reactive<UserInfo | NonNullable<unknown>>({}) as UnwrapNestedRefs<UserInfo>
  const isLogin = ref<boolean | null>(null)
  let unreadLoading = false
  let momentsLoading = false
  const { isActive, isAlive } = useTopBarPolling(getUserInfo, async () => {
    if (isLogin.value !== true)
      await getUserInfo()
    await Promise.all([getUnreadMessageCount(), getTopBarNewMomentsCount()])
  }, () => isLogin.value === null ? 10_000 : updateInterval)

  async function getUserInfo() {
    try {
      const res = await api.user.getUserInfo()
      if (!isAlive())
        return

      if (res.code === 0) {
        isLogin.value = true
        Object.assign(userInfo, res.data)
      }
      else if (res.code === -101) {
        isLogin.value = false
      }
    }
    catch (error) {
      if (isAlive())
        console.error(error)
    }
  }

  // #region Notifications
  const unReadMessageCount = ref<number>(0)
  let lastMessageCount = 0
  let lastDirectMessageCount = 0

  async function getUnreadMessageCount() {
    if (!isActive() || !isLogin.value || unreadLoading)
      return

    unreadLoading = true
    try {
      const [messages, dm] = await Promise.allSettled([api.notification.getUnreadMsg(), api.notification.getUnreadDm()])
      if (!isActive())
        return
      if (messages.status === 'fulfilled' && messages.value.code === 0 && messages.value.data) {
        let total = 0
        for (const [key, value] of Object.entries(messages.value.data)) {
          if (key !== 'up' && key !== 'recv_reply' && key !== 'recv_like' && typeof value === 'number')
            total += value
        }
        lastMessageCount = total
      }
      if (dm.status === 'fulfilled' && dm.value.code === 0 && dm.value.data)
        lastDirectMessageCount = typeof dm.value.data.follow_unread === 'number' ? dm.value.data.follow_unread : 0
      unReadMessageCount.value = lastMessageCount + lastDirectMessageCount
    }
    catch (error) {
      console.error(error)
    }
    finally {
      unreadLoading = false
    }
  }

  // #region Moments
  const newMomentsCount = ref<number>(0)

  async function getTopBarNewMomentsCount() {
    if (!isActive() || !isLogin.value || momentsLoading)
      return

    momentsLoading = true
    try {
      const res = await api.moment.getTopBarNewMomentsCount()
      const count = res.data?.update_info?.item?.count
      if (isActive() && res.code === 0 && typeof count === 'number')
        newMomentsCount.value = count
    }
    catch (error) {
      console.error(error)
    }
    finally {
      momentsLoading = false
    }
  }
  // #endregion
  return {
    userInfo,
    isLogin,
    isAlive,
    unReadMessageCount,
    newMomentsCount,
    getUnreadMessageCount,
    getTopBarNewMomentsCount,
  }
}
