import Taro from '@tarojs/taro'
import { io, type Socket } from 'socket.io-client'
import { WS_ORIGIN_URL } from '../config'
import { useAuthStore } from '../store/authStore'
import { emit as busEmit } from './eventBus'
import { useRealtimeStatus } from './status'
import { WeappSocketIoClient } from './weappSocketIoClient'

type SocketListener = (...args: unknown[]) => void

interface RealtimeSocket {
  connected: boolean
  connect: () => void
  disconnect: () => void
  on: (event: string, listener: SocketListener) => void
  removeAllListeners: (event: string) => void
}

const SOCKET_PATH = '/socket.io'
const CONNECT_TIMEOUT_MS = 20_000
const RECONNECT_DELAY_MS = 1000
const RECONNECT_DELAY_MAX_MS = 5000

let socket: RealtimeSocket | null = null
let networkHooked = false

function ensureNetworkHook() {
  if (networkHooked) return
  networkHooked = true
  Taro.onNetworkStatusChange((res) => {
    if (res.isConnected && socket && !socket.connected) {
      socket.connect()
    }
  })
}

/** 业务事件 → bus；页面/store 订阅 bus，互相解耦 */
const BUSINESS_EVENTS = [
  'daily:created',
  'daily:updated',
  'daily:deleted',
  'report:created',
  'report:updated',
  'report:deleted',
  'comment:added',
  'comment:updated',
  'comment:deleted',
  'anniversary:created',
  'anniversary:updated',
  'anniversary:deleted',
] as const

type BusinessEvent = (typeof BUSINESS_EVENTS)[number]

function attachBusinessListeners(s: RealtimeSocket) {
  for (const ev of BUSINESS_EVENTS) {
    s.on(ev, (payload: unknown) => busEmit<unknown>(ev, payload))
  }
}

function detachBusinessListeners(s: RealtimeSocket) {
  for (const ev of BUSINESS_EVENTS) {
    s.removeAllListeners(ev satisfies BusinessEvent)
  }
}

function createSocket(token: string): RealtimeSocket {
  if (process.env.TARO_ENV === 'weapp') {
    return new WeappSocketIoClient({
      url: WS_ORIGIN_URL,
      path: SOCKET_PATH,
      getToken: () => useAuthStore.getState().accessToken ?? '',
      timeout: CONNECT_TIMEOUT_MS,
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
    })
  }

  return io(WS_ORIGIN_URL, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    upgrade: false,
    autoConnect: false,
    auth: { token },
    timeout: CONNECT_TIMEOUT_MS,
    reconnection: true,
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
  })
}

export function startCoupleRealtime(): void {
  const token = useAuthStore.getState().accessToken
  if (!token) return

  if (socket) {
    detachBusinessListeners(socket)
    socket.disconnect()
    socket = null
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[momoya] couple realtime connecting', WS_ORIGIN_URL)
  }

  const s = createSocket(token)
  socket = s
  ensureNetworkHook()

  useRealtimeStatus.getState().markStarted()

  s.on('reconnect_attempt', () => {
    const t = useAuthStore.getState().accessToken ?? ''
    if ('auth' in s) (s as Socket).auth = { token: t }
  })

  s.on('connect', () => {
    useRealtimeStatus.getState().markConnected()
    if (process.env.NODE_ENV !== 'production') {
      console.info('[momoya] couple realtime socket connected')
    }
  })

  s.on('disconnect', () => {
    useRealtimeStatus.getState().markDisconnected()
  })

  s.on('connect_error', (err) => {
    useRealtimeStatus.getState().markDisconnected()
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[momoya] couple realtime connect_error',
        err?.message ?? err,
      )
    }
  })

  /** 重连成功后让所有列表/详情走兜底刷新，确保断线期间漏的事件不会让 UI 残留陈旧 */
  s.on('reconnect', () => {
    busEmit<void>('realtime:reconnect', undefined as void)
  })

  attachBusinessListeners(s)
  s.connect()
}

export function stopCoupleRealtime(): void {
  if (!socket) {
    useRealtimeStatus.getState().markStopped()
    return
  }
  detachBusinessListeners(socket)
  socket.disconnect()
  socket = null
  useRealtimeStatus.getState().markStopped()
}
