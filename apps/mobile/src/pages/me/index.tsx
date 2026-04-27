import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { resolveAssetUrl } from '../../config'
import { useRemoteImage } from '../../hooks/useRemoteImage'
import { authApi } from '../../services/auth'
import { ApiError } from '../../services/request'
import { useAuthStore } from '../../store/authStore'

const px = (n: number) => Taro.pxTransform(n)
/** 与 index.config.ts 中导航栏/背景色保持一致 */
const ME_NAV = '#C3B59F'

const HEADER_FLOATERS = [
  { char: '✿', cls: 'float-anim', pos: { top: '10%', right: '7%' }, delay: '0s', size: 44, color: '#A0AF84' },
  { char: '◌', cls: 'float-anim-slow', pos: { top: '5%', left: '5%' }, delay: '1.2s', size: 64, color: 'rgba(195,181,159,0.55)' },
  { char: '⊹', cls: 'float-anim', pos: { top: '22%', right: '20%' }, delay: '0.6s', size: 28, color: '#668F80' },
]

const MENU_ITEMS = [
  { label: '编辑资料', key: 'edit' },
  { label: '修改密码', key: 'password' },
  { label: '偏好设置', key: 'settings' },
] as const

const ICON_SLOT = px(44)
const MENU_ACCENT = '#668F80'

/** 固定槽位内的线形图标，避免 emoji 宽度不一导致文案错位 */
function MeMenuIcon({ kind }: { kind: (typeof MENU_ITEMS)[number]['key'] }) {
  const box: CSSProperties = {
    width: ICON_SLOT,
    height: ICON_SLOT,
    position: 'relative',
  }
  if (kind === 'settings') {
    const barW = px(22)
    const barH = px(3)
    const r = px(2)
    return (
      <View className="shrink-0 flex flex-col items-center justify-center" style={box}>
        <View style={{ width: barW, height: barH, backgroundColor: MENU_ACCENT, borderRadius: r, marginBottom: px(5) }} />
        <View style={{ width: barW, height: barH, backgroundColor: MENU_ACCENT, borderRadius: r, marginBottom: px(5) }} />
        <View style={{ width: barW, height: barH, backgroundColor: MENU_ACCENT, borderRadius: r }} />
      </View>
    )
  }
  if (kind === 'password') {
    const b = px(2)
    return (
      <View className="shrink-0 flex flex-col items-center justify-center" style={box}>
        <View
          style={{
            width: px(14),
            height: px(9),
            border: `${b} solid ${MENU_ACCENT}`,
            borderBottomWidth: 0,
            borderTopLeftRadius: px(10),
            borderTopRightRadius: px(10),
            boxSizing: 'border-box',
          }}
        />
        <View
          style={{
            width: px(24),
            height: px(15),
            marginTop: px(-1),
            backgroundColor: MENU_ACCENT,
            borderBottomLeftRadius: px(3),
            borderBottomRightRadius: px(3),
          }}
        />
      </View>
    )
  }
  // edit：斜向笔身 + 笔尖块
  return (
    <View className="shrink-0 flex items-center justify-center" style={box}>
      <View
        style={{
          position: 'absolute',
          left: '50%',
          top: px(6),
          marginLeft: px(-2),
          width: px(4),
          height: px(20),
          backgroundColor: MENU_ACCENT,
          borderRadius: px(1),
          transform: 'rotate(-52deg)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: px(10),
          bottom: px(9),
          width: px(8),
          height: px(8),
          backgroundColor: MENU_ACCENT,
          borderRadius: px(1),
          transform: 'rotate(-52deg)',
        }}
      />
    </View>
  )
}

export default function Me() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logoutStore = useAuthStore((s) => s.logout)

  const ensureAuthed = () => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return false
    }
    return true
  }

  const loadMe = async () => {
    if (!ensureAuthed()) return
    try {
      const me = await authApi.getMe()
      setUser(me)
    } catch (err) {
      if (!(err instanceof ApiError)) {
        Taro.showToast({ title: '加载用户信息失败', icon: 'none' })
      }
    }
  }

  usePullDownRefresh(() => {
    void (async () => {
      try {
        await loadMe()
      } finally {
        Taro.stopPullDownRefresh()
      }
    })()
  })

  useDidShow(() => {
    if (!ensureAuthed()) return
    void loadMe()
  })

  const handleMenuTap = (key: (typeof MENU_ITEMS)[number]['key']) => {
    if (key === 'edit') Taro.navigateTo({ url: '/pages/me/edit-profile/index' })
    else if (key === 'password') Taro.navigateTo({ url: '/pages/me/change-password/index' })
    else if (key === 'settings') Taro.navigateTo({ url: '/pages/me/settings/index' })
  }

  const handleLogout = async () => {
    const res = await Taro.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#668F80',
    })
    if (!res.confirm) return
    Taro.showLoading({ title: '退出中…', mask: true })
    try {
      await authApi.logout()
    } catch {}
    logoutStore()
    Taro.hideLoading()
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  const nickname = user?.nickname ?? '未登录'
  const username = user?.username ?? ''
  const bio = user?.bio || '还没有签名，快去写点什么～'
  const avatarUrl = useMemo(() => resolveAssetUrl(user?.avatar), [user?.avatar])
  const avatarSrc = useRemoteImage(avatarUrl)

  return (
    <View className="min-h-screen" style={{ backgroundColor: 'rgba(195,181,159,0.18)' }}>
      {/* 顶部头像区 */}
      <View
        className="relative overflow-hidden px-6 pb-8 pt-10"
        style={{
          background: `linear-gradient(160deg, ${ME_NAV} 0%, rgba(195,181,159,0.72) 100%)`,
        }}
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

        <View className="flex flex-col items-center">
          <View
            className="relative overflow-hidden rounded-full bg-white"
            style={{
              width: px(192),
              height: px(192),
              border: `3px solid #668F80`,
              boxShadow: `0 0 0 6px rgba(102,143,128,0.2)`,
            }}
            onClick={() => Taro.navigateTo({ url: '/pages/me/edit-profile/index' })}
          >
            {avatarSrc ? (
              <Image src={avatarSrc} className="h-full w-full" mode="aspectFill" />
            ) : (
              <View className="flex h-full w-full items-center justify-center">
                <Text style={{ fontSize: px(64), color: '#D6A2AD' }}>♡</Text>
              </View>
            )}
          </View>
          <Text className="mt-4 text-xl font-bold" style={{ color: '#4A6670' }}>{nickname}</Text>
          <Text className="mt-1 text-xs" style={{ color: '#668F80' }}>@{username}</Text>
          <Text
            className="mt-2 max-w-xs text-center text-xs leading-relaxed"
            style={{ color: '#4A6670' }}
          >
            {bio}
          </Text>
        </View>
      </View>

      {/* 菜单区 */}
      <View className="px-5 pt-5">
        <View
          className="rounded-2xl bg-white"
          style={{
            border: '1px solid rgba(195,181,159,0.5)',
            boxShadow: `0 ${px(4)} ${px(20)} rgba(74,102,112,0.07)`,
          }}
        >
          {MENU_ITEMS.map((item, idx) => (
            <View key={item.key}>
              <View
                className="flex items-center justify-between px-5 py-4"
                onClick={() => handleMenuTap(item.key)}
              >
                <View className="flex flex-1 items-center overflow-hidden">
                  <MeMenuIcon kind={item.key} />
                  <Text
                    className="min-w-0 flex-1 pl-3 text-base leading-none"
                    style={{ color: '#4A6670' }}
                  >
                    {item.label}
                  </Text>
                </View>
                <Text className="shrink-0 pl-2" style={{ color: '#C3B59F', fontSize: px(36) }}>
                  ›
                </Text>
              </View>
              {idx < MENU_ITEMS.length - 1 ? (
                <View
                  className="mx-5"
                  style={{ height: '1px', backgroundColor: 'rgba(195,181,159,0.35)' }}
                />
              ) : null}
            </View>
          ))}
        </View>

        {/* 退出登录 */}
        <View
          className="mt-4 flex w-full items-center justify-center rounded-full py-3"
          style={{
            border: '1px solid rgba(214,162,173,0.55)',
            backgroundColor: 'rgba(214,162,173,0.08)',
          }}
          onClick={handleLogout}
        >
          <Text className="text-sm font-medium" style={{ color: '#D6A2AD' }}>退出登录</Text>
        </View>

        <View className="mt-5 flex items-center justify-center pb-10">
          <Text style={{ fontSize: px(24), color: '#C3B59F' }}>✦</Text>
          <Text className="mx-1 text-xs" style={{ color: '#C3B59F' }}>momoya · 只属于我们两个人</Text>
          <Text style={{ fontSize: px(24), color: '#C3B59F' }}>✦</Text>
        </View>
      </View>
    </View>
  )
}
