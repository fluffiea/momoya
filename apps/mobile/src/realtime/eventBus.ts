/**
 * 极简事件总线，给页面级订阅 socket 业务事件用。
 * 选用 bus 而非把订阅直接挂到 socket 上的原因：
 *   - socket 实例可能不存在（未登录/未绑定 partner）；
 *   - 页面 unmount 后要保证清理干净，bus 提供统一的 `off` 模式；
 *   - 单测/H5 调试更易 mock。
 */
type Listener<T> = (data: T) => void

const map = new Map<string, Set<Listener<unknown>>>()

export function on<T>(event: string, listener: Listener<T>): () => void {
  let set = map.get(event)
  if (!set) {
    set = new Set()
    map.set(event, set)
  }
  set.add(listener as Listener<unknown>)
  return () => {
    const s = map.get(event)
    if (!s) return
    s.delete(listener as Listener<unknown>)
    if (s.size === 0) map.delete(event)
  }
}

export function emit<T>(event: string, data: T): void {
  const set = map.get(event)
  if (!set || set.size === 0) return
  for (const l of Array.from(set)) {
    try {
      l(data)
    } catch {
      /* 单个监听者抛错不影响其它 */
    }
  }
}
