import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { useRealtimeStatus } from '../realtime/status'

const px = (n: number) => Taro.pxTransform(n)

/** 断线持续多久才弹 banner，避免抖动 */
const GRACE_MS = 5000
const TICK_MS = 1000

/**
 * 顶部 banner：couple socket 断线超过 GRACE_MS 时显示，提示用户下拉刷新。
 * 重连成功后 socket 客户端会自动派发 `realtime:reconnect`，列表自动 refresh，
 * 这里只负责 UI 提示。
 */
export default function RealtimeStatusBanner() {
  const hasStarted = useRealtimeStatus((s) => s.hasStarted)
  const connected = useRealtimeStatus((s) => s.connected)
  const disconnectedAt = useRealtimeStatus((s) => s.disconnectedAt)
  const [now, setNow] = useState(() => Date.now())

  // 仅在断线状态下启动 1s 节拍，避免常驻定时器
  useEffect(() => {
    if (!hasStarted || connected !== false || disconnectedAt == null) return
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [hasStarted, connected, disconnectedAt])

  if (!hasStarted || connected !== false || disconnectedAt == null) return null
  if (now - disconnectedAt < GRACE_MS) return null

  return (
    <View
      className="fixed left-0 right-0 z-50 px-4"
      style={{ top: 0, paddingTop: px(8) }}
    >
      <View
        className="flex items-center justify-center rounded-full px-4"
        style={{
          height: px(56),
          backgroundColor: 'rgba(214,162,173,0.95)',
          boxShadow: `0 ${px(6)} ${px(20)} rgba(74,102,112,0.15)`,
        }}
      >
        <Text className="text-xs font-medium" style={{ color: '#fff' }}>
          实时连接已断开，下拉可手动刷新
        </Text>
      </View>
    </View>
  )
}
