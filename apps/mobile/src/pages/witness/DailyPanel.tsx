import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect } from 'react'
import type { PostDto } from '@momoya/shared'
import { DailyPostCard } from '../../components/post-cards'
import { postApi } from '../../services/post'
import { ApiError } from '../../services/request'
import { useAuthStore } from '../../store/authStore'
import { useDailyStore } from '../../store/postFeedStore'

const px = (n: number) => Taro.pxTransform(n)

interface Props {
  /** 当前子 tab 是否激活；false 时组件保持挂载但跳过自动刷新 */
  active: boolean
}

export default function DailyPanel({ active }: Props) {
  const user = useAuthStore((s) => s.user)
  const items = useDailyStore((s) => s.items)
  const loading = useDailyStore((s) => s.loading)
  const refreshing = useDailyStore((s) => s.refreshing)
  const hasMore = useDailyStore((s) => s.hasMore)
  const refreshDaily = useDailyStore((s) => s.refresh)
  const fetchNext = useDailyStore((s) => s.fetchNext)
  const removeById = useDailyStore((s) => s.removeById)
  const resetDaily = useDailyStore((s) => s.reset)

  const reload = useCallback(async () => {
    if (!useAuthStore.getState().isAuthed()) return
    try {
      await refreshDaily()
    } catch (err) {
      if (!(err instanceof ApiError)) {
        Taro.showToast({ title: '加载失败', icon: 'none' })
      }
    }
  }, [refreshDaily])

  useEffect(() => {
    if (!active) return
    void reload()
  }, [active, reload])

  useDidShow(() => {
    if (!active) return
    void reload()
  })

  useEffect(() => {
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (prev?.accessToken && !state.accessToken) {
        resetDaily()
      }
    })
    return unsub
  }, [resetDaily])

  const handleScrollToLower = () => {
    if (loading || !hasMore) return
    void fetchNext().catch(() => {
      Taro.showToast({ title: '加载更多失败', icon: 'none' })
    })
  }

  const handlePublish = () => {
    Taro.navigateTo({ url: '/pages/moments/publish/index' })
  }

  const handleOpenDetail = (p: PostDto) => {
    Taro.navigateTo({ url: `/pages/posts/detail/index?id=${p.id}` })
  }

  const handleLongPress = async (p: PostDto) => {
    if (!user || p.author.id !== user.id) return
    const res = await Taro.showActionSheet({ itemList: ['编辑', '删除'] }).catch(() => null)
    if (!res) return
    if (res.tapIndex === 0) {
      Taro.navigateTo({ url: `/pages/moments/publish/index?id=${p.id}` })
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
        <View className="flex flex-col gap-3 px-4 pb-24 pt-3">
          {items.length === 0 && !refreshing ? (
            <View className="mt-20 flex flex-col items-center gap-3">
              <Text style={{ fontSize: px(88), color: '#D6A2AD' }}>♡</Text>
              <Text className="text-sm" style={{ color: '#C3B59F' }}>
                还没有日常，点右下角开始写第一条
              </Text>
            </View>
          ) : (
            items.map((p) => (
              <DailyPostCard
                key={p.id}
                post={p}
                isMine={!!user && p.author.id === user.id}
                onLongPress={() => void handleLongPress(p)}
                onTap={() => handleOpenDetail(p)}
              />
            ))
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
            backgroundColor: '#668F80',
            boxShadow: `0 ${px(8)} ${px(28)} rgba(102,143,128,0.38)`,
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
