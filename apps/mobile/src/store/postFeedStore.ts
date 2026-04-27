import { create } from 'zustand'
import type { MeDto, PostDto, PostType, ReportFilter } from '@momoya/shared'
import { DEFAULT_REPORT_LIST_FILTER } from '@momoya/shared'
import { postApi } from '../services/post'

/**
 * 通用的 post feed store。
 * 一条 feed = 一种 (type, filter) 组合：
 *   - 日常 feed：type=daily，filter 恒为 'all'（这里直接透传）
 *   - 报备 feed：type=report，初始 filter 为 `DEFAULT_REPORT_LIST_FILTER`（shared），可在 all/unread/mine 间切换
 *
 * 对外暴露的 API 与原 momentStore 兼容（items / refresh / fetchNext / prepend / removeById / reset），
 * 额外：
 *   - `updateOne(post)` 用于编辑 / markRead / 评价变更后的本地同步
 *   - `setFilter(filter)`（仅报备场景有意义；日常调用是 no-op）
 */
export interface PostFeedState {
  readonly type: PostType
  filter: ReportFilter

  items: PostDto[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
  refreshing: boolean
  error: string | null

  reset: () => void
  refresh: () => Promise<void>
  fetchNext: () => Promise<void>
  prepend: (p: PostDto) => void
  updateOne: (p: PostDto) => void
  removeById: (id: string) => void
  setFilter: (filter: ReportFilter) => Promise<void>
}

function createPostFeedStore(type: PostType, initialFilter: ReportFilter = 'all') {
  return create<PostFeedState>((set, get) => ({
    type,
    filter: initialFilter,

    items: [],
    cursor: null,
    hasMore: true,
    loading: false,
    refreshing: false,
    error: null,

    reset: () => {
      set({
        items: [],
        cursor: null,
        hasMore: true,
        loading: false,
        refreshing: false,
        error: null,
      })
    },

    refresh: async () => {
      if (get().refreshing) return
      set({ refreshing: true, error: null })
      try {
        const res = await postApi.list({ type: get().type, filter: get().filter })
        set({
          items: res.items,
          cursor: res.nextCursor,
          hasMore: !!res.nextCursor,
          refreshing: false,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : '加载失败'
        set({ refreshing: false, error: msg })
        throw err
      }
    },

    fetchNext: async () => {
      const { loading, hasMore, cursor, type: t, filter: f } = get()
      if (loading || !hasMore) return
      set({ loading: true, error: null })
      try {
        const res = await postApi.list({
          type: t,
          filter: f,
          cursor: cursor ?? undefined,
        })
        set((s) => ({
          items: [...s.items, ...res.items],
          cursor: res.nextCursor,
          hasMore: !!res.nextCursor,
          loading: false,
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : '加载失败'
        set({ loading: false, error: msg })
        throw err
      }
    },

    prepend: (p) => {
      set((s) => ({ items: [p, ...s.items] }))
    },

    updateOne: (p) => {
      set((s) => ({
        items: s.items.map((it) => (it.id === p.id ? p : it)),
      }))
    },

    removeById: (id) => {
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }))
    },

    setFilter: async (filter) => {
      if (get().filter === filter) return
      set({
        filter,
        items: [],
        cursor: null,
        hasMore: true,
        loading: false,
        refreshing: false,
        error: null,
      })
      await get().refresh()
    },
  }))
}

export const useDailyStore = createPostFeedStore('daily', 'all')
export const useReportStore = createPostFeedStore('report', DEFAULT_REPORT_LIST_FILTER)

/** 登录 / hydrate / 设置保存后：用用户偏好对齐报备列表筛选（会触发列表刷新） */
export function syncReportListFilterFromUserSettings(user: MeDto | null): void {
  if (!user) return
  const next = user.settings.defaultReportListFilter
  const { filter, setFilter, refresh, items } = useReportStore.getState()
  if (filter !== next) {
    void setFilter(next)
    return
  }
  // 筛选未变但列表已空（如登出 reset 后再登录同一默认筛选）时仍需拉数
  if (items.length === 0) {
    void refresh()
  }
}

/**
 * 登出后清空两条 feed，避免下一账号与上一账号默认筛选相同时仍显示旧列表。
 * filter 回到产品默认（与未登录 store 初始一致）。
 */
export function resetPostFeedsAfterLogout(): void {
  useDailyStore.getState().reset()
  useReportStore.setState({
    filter: DEFAULT_REPORT_LIST_FILTER,
    items: [],
    cursor: null,
    hasMore: true,
    loading: false,
    refreshing: false,
    error: null,
  })
}
