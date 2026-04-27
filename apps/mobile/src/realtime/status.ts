import { create } from 'zustand'

/**
 * Couple Socket 连接状态。
 * - `connected=null` 表示尚未启动连接（未登录/未绑定 partner）；
 * - 顶部 banner 在 `connected===false && hasStarted===true && offlineMs >= GRACE_MS` 时显示。
 */
export interface RealtimeStatusState {
  hasStarted: boolean
  connected: boolean | null
  /** 本次断线开始时间（performance-like 毫秒）。connected===true 时为 null。 */
  disconnectedAt: number | null

  markStarted: () => void
  markStopped: () => void
  markConnected: () => void
  markDisconnected: () => void
}

export const useRealtimeStatus = create<RealtimeStatusState>((set, get) => ({
  hasStarted: false,
  connected: null,
  disconnectedAt: null,

  markStarted: () => {
    if (get().hasStarted) return
    set({ hasStarted: true, connected: false, disconnectedAt: Date.now() })
  },
  markStopped: () => {
    set({ hasStarted: false, connected: null, disconnectedAt: null })
  },
  markConnected: () => {
    set({ connected: true, disconnectedAt: null })
  },
  markDisconnected: () => {
    if (get().connected === false) return
    set({ connected: false, disconnectedAt: Date.now() })
  },
}))
