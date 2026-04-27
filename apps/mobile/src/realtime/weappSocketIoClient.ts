import Taro from '@tarojs/taro'

type Listener = (...args: unknown[]) => void
type SocketTaskResult = Taro.SocketTask | Promise<Taro.SocketTask>

interface WeappSocketIoClientOptions {
  url: string
  path: string
  getToken: () => string
  timeout: number
  reconnectionDelay: number
  reconnectionDelayMax: number
}

function toWsUrl(origin: string, path: string): string {
  const base = origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  const cleanBase = base.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}/?EIO=4&transport=websocket`
}

function isPromiseLike<T>(v: unknown): v is Promise<T> {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as { then?: unknown }).then === 'function'
  )
}

function connectSocket(
  opts: Parameters<typeof Taro.connectSocket>[0],
): SocketTaskResult {
  const wxApi = (globalThis as unknown as { wx?: { connectSocket?: unknown } }).wx
  const raw = wxApi?.connectSocket
  if (typeof raw === 'function') {
    return raw.call(wxApi, opts) as SocketTaskResult
  }
  return Taro.connectSocket(opts)
}

function normalizeMessage(data: unknown): string {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return decodeText(data)
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    const copy = new ArrayBuffer(view.byteLength)
    new Uint8Array(copy).set(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
    )
    return decodeText(copy)
  }
  return ''
}

function decodeText(data: ArrayBuffer): string {
  try {
    return new TextDecoder().decode(data)
  } catch {
    return ''
  }
}

/**
 * 小程序专用的最小 Socket.IO v4 客户端。
 *
 * 只实现当前业务需要的子集：
 * - Engine.IO websocket 握手：接收 `0{...}` 后发送 Socket.IO `40{auth}`
 * - Engine.IO 心跳：收到 `2` 回复 `3`
 * - Socket.IO 默认 namespace connect ack：收到 `40...` 后认为已连接
 * - 服务端业务事件：解析 `42["event", payload]`
 * - 自动重连与事件监听 API
 */
export class WeappSocketIoClient {
  connected = false

  private task: Taro.SocketTask | null = null
  private stopped = true
  private attempt = 0
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Map<string, Set<Listener>>()

  constructor(private readonly options: WeappSocketIoClientOptions) {}

  connect(): void {
    if (!this.stopped && (this.task || this.connected)) return
    this.stopped = false
    this.open()
  }

  disconnect(): void {
    this.stopped = true
    this.clearTimers()
    this.connected = false
    const task = this.task
    this.task = null
    if (task) {
      try {
        task.close({ code: 1000, reason: 'client disconnect' })
      } catch {
        /* ignore close failure */
      }
    }
  }

  on(event: string, listener: Listener): void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener)
  }

  removeAllListeners(event: string): void {
    this.listeners.delete(event)
  }

  private open(): void {
    this.clearTimers()
    const url = toWsUrl(this.options.url, this.options.path)

    this.connectTimer = setTimeout(() => {
      this.failConnect(new Error('timeout'))
    }, this.options.timeout)

    try {
      const ret = connectSocket({ url, tcpNoDelay: true })
      const bind = (task: Taro.SocketTask) => {
        if (this.stopped) {
          task.close({ code: 1000, reason: 'client stopped' })
          return
        }
        this.task = task
        this.bindTask(task)
      }
      if (isPromiseLike<Taro.SocketTask>(ret)) {
        void ret.then(bind).catch((err: unknown) => this.failConnect(err))
      } else {
        bind(ret)
      }
    } catch (err) {
      this.failConnect(err)
    }
  }

  private bindTask(task: Taro.SocketTask): void {
    task.onMessage((res: { data: unknown }) => {
      this.handlePacket(normalizeMessage(res.data))
    })

    task.onError((res: { errMsg?: string }) => {
      this.failConnect(new Error(res.errMsg ?? 'socket error'))
    })

    task.onClose(() => {
      const wasConnected = this.connected
      this.task = null
      this.connected = false
      this.clearConnectTimer()
      if (wasConnected) this.emit('disconnect')
      if (!this.stopped) this.scheduleReconnect()
    })
  }

  private handlePacket(raw: string): void {
    if (!raw) return

    if (raw === '2') {
      this.sendRaw('3')
      return
    }

    if (raw[0] === '0') {
      const token = this.options.getToken()
      this.sendRaw(`40${JSON.stringify({ token })}`)
      return
    }

    if (raw.startsWith('40')) {
      this.clearConnectTimer()
      const wasReconnecting = this.attempt > 0
      this.attempt = 0
      this.connected = true
      this.emit('connect')
      if (wasReconnecting) this.emit('reconnect')
      return
    }

    if (raw.startsWith('42')) {
      this.handleEventPacket(raw.slice(2))
      return
    }

    if (raw.startsWith('44')) {
      this.failConnect(new Error(raw.slice(2) || 'connect_error'))
    }
  }

  private handleEventPacket(payload: string): void {
    try {
      const decoded = JSON.parse(payload) as unknown
      if (!Array.isArray(decoded) || typeof decoded[0] !== 'string') return
      this.emit(decoded[0], decoded[1])
    } catch {
      /* ignore malformed socket.io packet */
    }
  }

  private sendRaw(data: string): void {
    try {
      this.task?.send({ data })
    } catch (err) {
      this.failConnect(err)
    }
  }

  private failConnect(err: unknown): void {
    this.clearConnectTimer()
    const message = err instanceof Error ? err.message : String(err)
    const task = this.task
    this.task = null
    const wasConnected = this.connected
    this.connected = false
    if (wasConnected) this.emit('disconnect')
    else this.emit('connect_error', new Error(message))
    try {
      task?.close({ code: 1000, reason: message })
    } catch {
      /* ignore close failure */
    }
    if (!this.stopped) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.attempt += 1
    this.emit('reconnect_attempt')
    const delay = Math.min(
      this.options.reconnectionDelayMax,
      this.options.reconnectionDelay * this.attempt,
    )
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stopped) this.open()
    }, delay)
  }

  private clearConnectTimer(): void {
    if (!this.connectTimer) return
    clearTimeout(this.connectTimer)
    this.connectTimer = null
  }

  private clearTimers(): void {
    this.clearConnectTimer()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return
    for (const listener of Array.from(set)) {
      try {
        listener(...args)
      } catch {
        /* 单个 listener 抛错不影响其它 */
      }
    }
  }
}
