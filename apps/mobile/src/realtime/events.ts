import type { PostDto } from '@momoya/shared'
import { useAuthStore } from '../store/authStore'
import { useDailyStore, useReportStore } from '../store/postFeedStore'
import { on } from './eventBus'

function isPostDtoShape(p: unknown): p is PostDto {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  const author = o.author
  return (
    typeof o.id === 'string' &&
    author !== null &&
    typeof author === 'object' &&
    typeof (author as Record<string, unknown>).id === 'string'
  )
}

function refreshDaily() {
  void useDailyStore.getState().refresh()
}

function refreshReport() {
  void useReportStore.getState().refresh()
}

let installed = false

/** 应用启动且 socket 已 start 后调用一次即可，幂等 */
export function installRealtimeEventHandlers(): void {
  if (installed) return
  installed = true

  on<{ post?: unknown }>('daily:created', (payload) => {
    if (!isPostDtoShape(payload?.post)) return
    const post = payload.post
    const me = useAuthStore.getState().user?.id
    // 自己发的：本地已 prepend，避免再插一条造成重复
    if (me && post.author.id === me) {
      if (useDailyStore.getState().items.some((it) => it.id === post.id)) return
    }
    useDailyStore.getState().prepend(post)
  })

  on<{ post?: unknown }>('daily:updated', (payload) => {
    if (!isPostDtoShape(payload?.post)) return
    useDailyStore.getState().updateOne(payload.post)
  })

  on<{ id?: unknown }>('daily:deleted', (payload) => {
    const id = payload?.id
    if (typeof id !== 'string' || !id) return
    useDailyStore.getState().removeById(id)
  })

  // report 有 all/unread/mine 三档筛选，统一刷新当前筛选更可靠。
  on('report:created', refreshReport)
  on('report:updated', refreshReport)
  on('report:deleted', refreshReport)

  on('comment:added', refreshDaily)
  on('comment:deleted', refreshDaily)

  on('realtime:reconnect', () => {
    refreshDaily()
    refreshReport()
  })
}
