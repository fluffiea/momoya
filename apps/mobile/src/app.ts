import { PropsWithChildren, useEffect } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { API_BASE_URL } from './config'
import {
  startCoupleRealtime,
  stopCoupleRealtime,
} from './realtime/socket'
import { installRealtimeEventHandlers } from './realtime/events'
import { useAuthStore } from './store/authStore'

import './app.css'

installRealtimeEventHandlers()

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[momoya] API_BASE_URL =', API_BASE_URL)
    }
    const store = useAuthStore.getState()
    store.hydrate()
    if (!store.isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' }).catch(() => {
        // 启动极早期 reLaunch 可能失败，忽略；Me 页的 useLoad 兜底会再判断一次
      })
    }
  })

  /**
   * 情侣 Socket 必须挂在 App：tabBar 子页按需加载，用户若从未点开「见证」，
   * WitnessPage 不会挂载，实时推送永远不会建连（伴侣端列表不更新）。
   */
  const coupleRealtimeReady = useAuthStore(
    (s) => s.hydrated && !!s.accessToken && !!s.user?.partnerId,
  )
  useEffect(() => {
    if (!coupleRealtimeReady) {
      stopCoupleRealtime()
      return
    }
    startCoupleRealtime()
    return () => {
      stopCoupleRealtime()
    }
  }, [coupleRealtimeReady])

  return children
}

/**
 * 尽早从 Storage 恢复登录态，使首轮渲染时 `hydrated` / `partnerId` 已就绪，
 * App 内建连 Socket 的 `useEffect` 不必再等 `useLaunch`，避免从未执行 `startCoupleRealtime`。
 * （`useLaunch` 里仍会再调一次 `hydrate`，幂等。）
 */
useAuthStore.getState().hydrate()

export default App
