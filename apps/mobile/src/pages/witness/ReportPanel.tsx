import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect } from 'react'
import type { PostDto, ReportFilter } from '@momoya/shared'
import { ReportPostCard } from '../../components/post-cards'
import { postApi } from '../../services/post'
import { ApiError } from '../../services/request'
import { useAuthStore } from '../../store/authStore'
import { useReportStore } from '../../store/postFeedStore'

const px = (n: number) => Taro.pxTransform(n)

/** 顺序：待办 → 全量 → 我的；短文案避免与页头 pill 抢视觉 */
const FILTERS: Array<{ key: ReportFilter; label: string }> = [
  { key: 'unread', label: '待阅读' },
  { key: 'all', label: '全部' },
  { key: 'mine', label: '我的' },
]

function emptyListHint(f: ReportFilter): string {
  if (f === 'unread') return '暂无待阅读'
  if (f === 'mine') return '暂无我的报备'
  return '暂无报备'
}

/** 次级筛选：下划线指示，与页头「日常/报备」pill 区分层次 */
function ReportFilterTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <View className="flex min-w-0 flex-1 flex-col items-center" onClick={onClick}>
      <View className="flex w-full items-center justify-center py-2">
        <Text
          className="text-sm"
          style={{
            fontWeight: active ? '600' : '400',
            color: active ? '#4A6670' : 'rgba(74,102,112,0.5)',
          }}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          height: px(4),
          width: active ? px(34) : 0,
          borderRadius: px(2),
          backgroundColor: '#668F80',
          opacity: active ? 1 : 0,
        }}
      />
    </View>
  )
}

interface Props {
  active: boolean
}

export default function ReportPanel({ active }: Props) {
  const user = useAuthStore((s) => s.user)
  const filter = useReportStore((s) => s.filter)
  const items = useReportStore((s) => s.items)
  const loading = useReportStore((s) => s.loading)
  const refreshing = useReportStore((s) => s.refreshing)
  const hasMore = useReportStore((s) => s.hasMore)
  const refreshReports = useReportStore((s) => s.refresh)
  const fetchNext = useReportStore((s) => s.fetchNext)
  const removeById = useReportStore((s) => s.removeById)
  const resetReports = useReportStore((s) => s.reset)
  const setFilter = useReportStore((s) => s.setFilter)

  const reload = useCallback(async () => {
    if (!useAuthStore.getState().isAuthed()) return
    try {
      await refreshReports()
    } catch (err) {
      if (!(err instanceof ApiError)) {
        Taro.showToast({ title: '加载失败', icon: 'none' })
      }
    }
  }, [refreshReports])

  useEffect(() => {
    if (!active) return
    void reload()
  }, [active, reload])

  /** 与 DailyPanel 一致：从详情等子页返回时页面 onShow 会触发，避免列表陈旧 */
  useDidShow(() => {
    if (!active) return
    void reload()
  })

  useEffect(() => {
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (prev?.accessToken && !state.accessToken) resetReports()
    })
    return unsub
  }, [resetReports])

  const handleScrollToLower = () => {
    if (loading || !hasMore) return
    void fetchNext().catch(() => {
      Taro.showToast({ title: '加载更多失败', icon: 'none' })
    })
  }

  const handleTapFilter = (key: ReportFilter) => {
    if (key === filter) return
    void setFilter(key).catch(() => {
      Taro.showToast({ title: '切换失败', icon: 'none' })
    })
  }

  const handlePublish = () => {
    Taro.navigateTo({ url: '/pages/reports/publish/index' })
  }

  const handleOpenDetail = (p: PostDto) => {
    Taro.navigateTo({ url: `/pages/posts/detail/index?id=${p.id}` })
  }

  const handleLongPress = async (p: PostDto) => {
    if (!user || p.author.id !== user.id) return
    const res = await Taro.showActionSheet({ itemList: ['编辑', '删除'] }).catch(() => null)
    if (!res) return
    if (res.tapIndex === 0) {
      Taro.navigateTo({ url: `/pages/reports/publish/index?id=${p.id}` })
      return
    }
    if (res.tapIndex !== 1) return
    const confirm = await Taro.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      confirmColor: '#668F80',
    })
    if (!confirm.confirm) return
    Taro.showLoading({ title: '删除中…', mask: true })
    try {
      await postApi.remove(p.id)
      removeById(p.id)
      Taro.hideLoading()
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch (err) {
      Taro.hideLoading()
      const msg = err instanceof ApiError ? err.msg : '删除失败'
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }

  return (
    <View className="flex min-h-0 flex-1 flex-col">
      <View
        className="shrink-0 px-3 pb-1 pt-3"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(195,181,159,0.45)' }}
      >
        <View className="flex items-stretch">
          {FILTERS.map((f) => (
            <ReportFilterTab
              key={f.key}
              active={f.key === filter}
              label={f.label}
              onClick={() => handleTapFilter(f.key)}
            />
          ))}
        </View>
      </View>

      <ScrollView
        className="min-h-0 flex-1"
        scrollY
        enableBackToTop
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => void reload()}
        onScrollToLower={handleScrollToLower}
        lowerThreshold={80}
      >
        <View className="flex flex-col gap-2 px-4 pb-24 pt-3">
          {items.length === 0 && !refreshing ? (
            <View className="mt-20 flex flex-col items-center gap-3">
              <Text style={{ fontSize: px(80), color: '#C3B59F' }}>✦</Text>
              <Text className="text-center text-sm" style={{ color: '#C3B59F' }}>
                {emptyListHint(filter)}
              </Text>
            </View>
          ) : (
            items.map((p) => {
              const mine = !!user && p.author.id === user.id
              return (
                <ReportPostCard
                  key={p.id}
                  post={p}
                  isMine={mine}
                  onLongPress={() => void handleLongPress(p)}
                  onTap={() => handleOpenDetail(p)}
                />
              )
            })
          )}

          {loading ? (
            <View className="py-4 text-center">
              <Text className="text-xs" style={{ color: '#C3B59F' }}>加载中…</Text>
            </View>
          ) : null}
          {!loading && items.length > 0 && !hasMore ? (
            <View className="py-4 text-center">
              <Text className="text-xs" style={{ color: '#C3B59F' }}>到底啦 ♡</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {active ? (
        <View
          className="fixed bottom-24 right-6 flex items-center justify-center rounded-full"
          style={{
            width: px(112),
            height: px(112),
            backgroundColor: '#A0AF84',
            boxShadow: `0 ${px(8)} ${px(28)} rgba(160,175,132,0.38)`,
          }}
          onClick={handlePublish}
        >
          <Text
            style={{
              fontSize: px(56),
              lineHeight: px(56),
              color: '#fff',
              fontWeight: '300',
            }}
          >
            +
          </Text>
        </View>
      ) : null}
    </View>
  )
}
