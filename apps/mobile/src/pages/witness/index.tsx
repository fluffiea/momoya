import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_WITNESS_TAB, type WitnessDefaultTab } from '@momoya/shared'
import RealtimeStatusBanner from '../../components/RealtimeStatusBanner'
import { useAuthStore } from '../../store/authStore'
import DailyPanel from './DailyPanel'
import ReportPanel from './ReportPanel'

const px = (n: number) => Taro.pxTransform(n)

const HEADER_FLOATERS = [
  { char: '✿', cls: 'float-anim', pos: { top: '12%', right: '7%' }, delay: '0.5s', size: 36, color: '#A0AF84' },
  { char: '◌', cls: 'float-anim-slow', pos: { top: '5%', right: '30%' }, delay: '1s', size: 52, color: 'rgba(195,181,159,0.55)' },
]

export default function WitnessPage() {
  useLoad(() => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  const defaultTab = useAuthStore((s) => s.user?.settings.defaultWitnessTab ?? DEFAULT_WITNESS_TAB)
  const [tab, setTab] = useState<WitnessDefaultTab>(defaultTab)

  // 见证页是 tabBar 页面，切走再切回不会 unmount，useState 的初始值只会在首次 mount 时生效。
  // 当用户在「独白 → 设置」页改了默认 tab 后回到本页，需要让 tab 跟上新偏好。
  // 但页面内手动切换的选择「仅本次会话有效，不回写设置」（见文件顶部注释），
  // 所以只在 defaultTab 真正发生变化时同步，避免每次 rerender 都把用户手动的选择拽回去。
  const lastDefaultRef = useRef(defaultTab)
  useEffect(() => {
    if (lastDefaultRef.current !== defaultTab) {
      lastDefaultRef.current = defaultTab
      setTab(defaultTab)
    }
  }, [defaultTab])

  return (
    <View className="flex h-full min-h-0 flex-col" style={{ backgroundColor: 'rgba(195,181,159,0.18)' }}>
      <RealtimeStatusBanner />
      {/* 顶部 header + tab 切换 */}
      <View
        className="relative overflow-hidden px-5 pb-4 pt-7"
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

        <View className="mb-3 flex items-center gap-2">
          <Text style={{ fontSize: px(32), color: '#A0AF84' }}>✦</Text>
          <Text className="text-xl font-bold" style={{ color: '#4A6670' }}>见证</Text>
        </View>

        {/* Tab 切换 pill */}
        <View
          className="flex items-center gap-1 rounded-full p-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.38)' }}
        >
          <TabSegment active={tab === 'daily'} label="日常" onClick={() => setTab('daily')} />
          <TabSegment active={tab === 'report'} label="报备" onClick={() => setTab('report')} />
        </View>
      </View>

      {/*
        两个子面板都保持挂载，避免切换时丢失滚动位置。
        非 active 的一方通过 prop 跳过自动刷新，用 inline style 控制显隐。
      */}
      <View className="flex min-h-0 flex-1 flex-col" style={{ display: tab === 'daily' ? 'flex' : 'none' }}>
        <DailyPanel active={tab === 'daily'} />
      </View>
      <View className="flex min-h-0 flex-1 flex-col" style={{ display: tab === 'report' ? 'flex' : 'none' }}>
        <ReportPanel active={tab === 'report'} />
      </View>
    </View>
  )
}

function TabSegment({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <View
      className="flex-1 rounded-full py-1.5 text-center"
      style={{ backgroundColor: active ? '#668F80' : 'transparent' }}
      onClick={onClick}
    >
      <Text
        className="text-sm font-medium"
        style={{ color: active ? '#fff' : '#4A6670' }}
      >
        {label}
      </Text>
    </View>
  )
}
