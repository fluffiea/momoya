import { Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnniversaryDto, PartnerBriefDto } from '@momoya/shared'
import RealtimeStatusBanner from '../../components/RealtimeStatusBanner'
import { on as onRealtime } from '../../realtime/eventBus'
import { anniversaryApi } from '../../services/anniversary'
import { ApiError } from '../../services/request'
import { userApi } from '../../services/user'
import { useAuthStore } from '../../store/authStore'
import {
  computeAnniversaryStats,
  formatMonthDay,
  isoToPickerValue,
  pickerValueToIso,
} from '../../utils/anniversary'
import { TogetherAnniversaryHero } from './TogetherAnniversaryHero'

const px = (n: number) => Taro.pxTransform(n)

const HEADER_FLOATERS = [
  { char: '✿', cls: 'float-anim', pos: { top: '14%', right: '8%' }, delay: '0.3s', size: 44, color: '#A0AF84' },
  { char: '◌', cls: 'float-anim-slow', pos: { top: '6%', right: '28%' }, delay: '0.9s', size: 60, color: 'rgba(195,181,159,0.6)' },
  { char: '⊹', cls: 'float-anim', pos: { top: '20%', left: '6%' }, delay: '1.5s', size: 32, color: '#668F80' },
]

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const [items, setItems] = useState<AnniversaryDto[]>([])
  const [partner, setPartner] = useState<PartnerBriefDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const ensureAuthed = useCallback(() => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return false
    }
    return true
  }, [])

  const load = useCallback(async () => {
    if (!ensureAuthed()) return
    setLoading(true)
    try {
      const res = await anniversaryApi.list()
      setItems(res.items)
      try {
        const p = await userApi.getPartner()
        setPartner(p)
      } catch {
        setPartner(null)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorKey !== 'E_ANNIV_FORBIDDEN') {
          Taro.showToast({ title: err.msg || '加载失败', icon: 'none' })
        }
      } else {
        Taro.showToast({ title: '加载失败', icon: 'none' })
      }
      setItems([])
      setPartner(null)
    } finally {
      setLoading(false)
    }
  }, [ensureAuthed])

  useLoad(() => {
    void load()
  })
  useDidShow(() => {
    void load()
  })

  useEffect(() => {
    if (refreshTick === 0) return
    void load()
  }, [refreshTick, load])

  useEffect(() => {
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (prev.accessToken && !state.accessToken) {
        setItems([])
        setPartner(null)
      }
    })
    return unsub
  }, [])

  /**
   * 订阅纪念日实时事件：partner 端任意 CUD 都触发本端 reload。
   * 由于纪念日数量小（上限有限），整体重拉成本可接受，比维护增量更新更稳。
   */
  useEffect(() => {
    const offCreated = onRealtime<{ item: AnniversaryDto }>(
      'anniversary:created',
      () => setRefreshTick((n) => n + 1),
    )
    const offUpdated = onRealtime<{ item: AnniversaryDto }>(
      'anniversary:updated',
      () => setRefreshTick((n) => n + 1),
    )
    const offDeleted = onRealtime<{ id: string }>(
      'anniversary:deleted',
      () => setRefreshTick((n) => n + 1),
    )
    return () => {
      offCreated()
      offUpdated()
      offDeleted()
    }
  }, [])

  const handleChangeDate = useCallback(
    async (item: AnniversaryDto, val: string) => {
      Taro.showLoading({ title: '保存中…', mask: true })
      try {
        await anniversaryApi.update(item.id, { date: pickerValueToIso(val) })
        Taro.hideLoading()
        Taro.showToast({ title: '已更新', icon: 'success' })
        setRefreshTick((n) => n + 1)
      } catch (err) {
        Taro.hideLoading()
        const msg = err instanceof ApiError ? err.msg : '保存失败'
        Taro.showToast({ title: msg, icon: 'none' })
      }
    },
    [],
  )

  const together = useMemo(
    () => items.find((a) => a.isSystem) ?? null,
    [items],
  )
  const rest = useMemo(() => items.filter((a) => !a.isSystem), [items])

  return (
    <View className="min-h-screen" style={{ backgroundColor: 'rgba(195,181,159,0.18)' }}>
      <RealtimeStatusBanner />
      {/* 页面顶部 header */}
      <View
        className="relative overflow-hidden px-5 pb-5 pt-8"
        style={{ background: 'linear-gradient(160deg, #C3B59F 0%, rgba(195,181,159,0.72) 100%)' }}
      >
        {HEADER_FLOATERS.map((f, i) => (
          <Text
            key={i}
            className={`pointer-events-none absolute ${f.cls}`}
            style={{ ...f.pos, fontSize: px(f.size), color: f.color, animationDelay: f.delay }}
          >
            {f.char}
          </Text>
        ))}
        <View className="flex items-baseline justify-between">
          <View className="flex items-center gap-2">
            <Text style={{ fontSize: px(32), color: '#A0AF84' }}>✦</Text>
            <Text className="text-xl font-bold" style={{ color: '#4A6670' }}>纪念日</Text>
          </View>
          <Text className="text-xs" style={{ color: '#668F80' }}>
            {user?.nickname ? `Hi, ${user.nickname} ♡` : ''}
          </Text>
        </View>
      </View>

      {/* 内容区 */}
      <View className="px-4 pb-8 pt-4">
        {loading && items.length === 0 ? (
          <View className="mt-20 flex flex-col items-center gap-3">
            <Text className="float-anim-slow" style={{ fontSize: px(64), color: '#C3B59F' }}>◌</Text>
            <Text className="text-sm" style={{ color: '#C3B59F' }}>加载中…</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="mt-20 flex flex-col items-center gap-3">
            <Text style={{ fontSize: px(96), color: '#D6A2AD' }}>♡</Text>
            <Text className="text-sm" style={{ color: '#C3B59F' }}>暂时还没有纪念日</Text>
          </View>
        ) : (
          <View>
            {together ? (
              <TogetherAnniversaryHero item={together} me={user} partner={partner} />
            ) : null}
            {rest.length > 0 ? (
              <View className="grid grid-cols-2 gap-3">
                {rest.map((a) => (
                  <AnniversaryCard
                    key={a.id}
                    item={a}
                    onChangeDate={(val) => void handleChangeDate(a, val)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}

interface CardProps {
  item: AnniversaryDto
  onChangeDate: (val: string) => void
}

function AnniversaryCard({ item, onChangeDate }: CardProps) {
  const stats = computeAnniversaryStats(item.date)
  const pickerVal = isoToPickerValue(item.date)

  return (
    <Picker
      mode="date"
      value={pickerVal}
      onChange={(e) => onChangeDate(String(e.detail.value))}
    >
      <View
        className="flex flex-col gap-1 rounded-2xl bg-white p-4"
        style={{
          border: '1px solid rgba(195,181,159,0.55)',
          boxShadow: `0 ${px(4)} ${px(24)} rgba(74,102,112,0.08)`,
        }}
      >
        <View className="flex items-start justify-between gap-1">
          <Text
            className="flex-1 truncate text-sm font-semibold"
            style={{ color: '#4A6670' }}
          >
            {item.name}
          </Text>
        </View>
        <Text style={{ fontSize: px(22), color: '#C3B59F' }}>{formatMonthDay(item.date)}</Text>
        <View className="mt-1 flex items-baseline gap-0.5">
          <Text className="text-2xl font-bold" style={{ color: '#668F80' }}>
            {stats.totalDays}
          </Text>
          <Text style={{ fontSize: px(24), color: '#A0AF84' }}> 天</Text>
        </View>
        <Text style={{ fontSize: px(22), color: stats.daysToNext === 0 ? '#D6A2AD' : '#C3B59F' }}>
          {stats.daysToNext === 0
            ? '就是今天 🎉'
            : `距下次 ${stats.daysToNext} 天`}
        </Text>
      </View>
    </Picker>
  )
}
