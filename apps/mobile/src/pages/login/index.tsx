import { Button, Form, Input, Picker, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { memo, useCallback, useState } from 'react'
import { PASSWORD_MIN } from '@momoya/shared'
import { ApiError } from '../../services/request'
import { authApi } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import { showToastThen } from '../../utils/showToastThen'

const ACCOUNTS = ['jiangjiang', 'mengmeng'] as const

/** 与原生 selector 首列一致；选 0 时用户名为空 */
const ACCOUNT_PICK_PLACEHOLDER = '先选个要登的号'
const ACCOUNT_PICKER_RANGE = [ACCOUNT_PICK_PLACEHOLDER, 'jiangjiang', 'mengmeng'] as const

/**
 * 内联 style 里的尺寸走 Taro.pxTransform，参数是 750 设计稿标注值
 * 详见 .cursor/rules/styling-conventions.mdc 三
 */
const px = (n: number) => Taro.pxTransform(n)

/** 与 .login-field-row / .login-password-input 的横向 32px 分工：这里只管文案字号与行高 */
const FIELD_TEXT_STYLE = {
  height: px(96),
  fontSize: px(32),
  lineHeight: px(96),
  color: '#4A6670',
} as const

const FLOATERS = [
  { char: '✿', cls: 'float-anim', pos: { top: '6%', left: '7%' }, delay: '0s', size: 56, color: '#A0AF84' },
  { char: '⊹', cls: 'float-anim-slow', pos: { top: '11%', right: '9%' }, delay: '0.8s', size: 36, color: '#668F80' },
  { char: '❋', cls: 'float-anim', pos: { top: '18%', left: '14%' }, delay: '1.2s', size: 40, color: '#D6A2AD' },
  { char: '◌', cls: 'float-anim-slow', pos: { top: '5%', right: '22%' }, delay: '0.4s', size: 72, color: '#C3B59F' },
  { char: '✦', cls: 'float-anim', pos: { bottom: '20%', left: '4%' }, delay: '2s', size: 60, color: '#A0AF84' },
  { char: '❋', cls: 'float-anim', pos: { bottom: '14%', right: '7%' }, delay: '1.6s', size: 44, color: '#668F80' },
  { char: '✿', cls: 'float-anim-slow', pos: { bottom: '28%', right: '14%' }, delay: '0.2s', size: 32, color: '#D6A2AD' },
]

/**
 * 小程序原生 Picker，避免自定义 Input+blur+延迟关菜单 与下一项 Input 的聚焦竞争。
 * 文案样式仅走 app.css 的 .login-input-placeholder 或正文色，不叠 placeholderStyle 以免真机抖。
 */
const AccountPickerField = memo(function AccountPickerField({
  value,
  onChange,
}: {
  value: number
  onChange: (index: number) => void
}) {
  return (
    <Picker
      mode="selector"
      range={[...ACCOUNT_PICKER_RANGE]}
      value={value}
      onChange={(e) => onChange(Number(e.detail.value))}
    >
      <View
        className="login-field-row flex h-12 w-full flex-row items-center overflow-hidden rounded-2xl"
        style={{ background: 'rgba(195,181,159,0.15)', border: '1px solid #668F80' }}
      >
        <Text
          className="flex-1"
          style={value === 0 ? { ...FIELD_TEXT_STYLE, color: '#D6A2AD' } : FIELD_TEXT_STYLE}
        >
          {value === 0
            ? ACCOUNT_PICK_PLACEHOLDER
            : `${ACCOUNTS[value - 1] === 'mengmeng' ? '🌸 ' : '🌿 '}${ACCOUNTS[value - 1]}`}
        </Text>
      </View>
    </Picker>
  )
})

const PasswordField = memo(function PasswordField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <View
      className="flex h-12 flex-row items-center overflow-hidden rounded-2xl"
      style={{ background: 'rgba(195,181,159,0.15)', border: '1px solid #668F80' }}
    >
      <Input
        className="login-password-input flex-1"
        password
        placeholder="对一下你的暗号"
        placeholderClass="login-input-placeholder"
        value={value}
        onInput={(e) => onChange(e.detail.value)}
        maxlength={64}
      />
    </View>
  )
})

export default function Login() {
  const [accountPickerIndex, setAccountPickerIndex] = useState(0)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loginToStore = useAuthStore((s) => s.login)

  const setPasswordStable = useCallback((v: string) => setPassword(v), [])

  const username = accountPickerIndex === 0 ? '' : ACCOUNTS[accountPickerIndex - 1]

  useLoad(() => {
    if (useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/home/index' })
    }
  })

  const handleSubmit = async () => {
    const u = username.trim()
    const p = password
    if (u.length < 3) {
      Taro.showToast({ title: '用户名至少 3 位', icon: 'none' })
      return
    }
    if (p.length < PASSWORD_MIN) {
      Taro.showToast({ title: `密码至少 ${PASSWORD_MIN} 位`, icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const result = await authApi.login({ username: u, password: p })
      loginToStore({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessExpiresIn: result.accessExpiresIn,
        refreshExpiresIn: result.refreshExpiresIn,
        user: result.user,
      })
      showToastThen(
        { title: `欢迎回来，${result.user.nickname} ♡`, icon: 'success' },
        () => {
          void Taro.reLaunch({ url: '/pages/home/index' })
        },
        { delayMs: 600 },
      )
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.msg : err instanceof Error ? err.message : '登录失败'
      Taro.showToast({ title: msg, icon: 'none', duration: 2500 })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View
      className="relative flex min-h-screen flex-col items-center justify-center px-6"
      style={{
        // 仅使用色板内的 warm-sand，用透明度叠出层次（详见 .cursor/rules/color-palette.mdc）
        background:
          'linear-gradient(160deg, #C3B59F 0%, rgba(195,181,159,0.85) 50%, rgba(195,181,159,0.65) 100%)',
      }}
    >
      {FLOATERS.map((f, i) => (
        <Text
          key={i}
          className={`pointer-events-none absolute ${f.cls}`}
          style={{ ...f.pos, fontSize: px(f.size), color: f.color, animationDelay: f.delay }}
        >
          {f.char}
        </Text>
      ))}

      <View
        className="relative z-10 -mt-12 w-full rounded-3xl bg-white px-7 py-9"
        style={{
          border: '1px solid #C3B59F',
          boxShadow: `0 ${px(16)} ${px(64)} rgba(74,102,112,0.12)`,
        }}
      >
        <View className="mb-7 flex flex-col items-center gap-1">
          <View className="mb-1 flex flex-row items-center gap-2">
            <Text style={{ fontSize: px(40), color: '#A0AF84' }}>✿</Text>
            <Text className="text-2xl font-bold" style={{ color: '#4A6670' }}>欢迎回来</Text>
            <Text style={{ fontSize: px(40), color: '#A0AF84' }}>✿</Text>
          </View>
          <Text className="text-sm" style={{ color: '#668F80' }}>萌萌 & 江江的小站</Text>
        </View>

        <Form>
          <View className="flex flex-col gap-5">
            <View className="flex flex-col gap-2">
              <Text className="text-xs font-medium" style={{ color: '#4A6670' }}>你是谁呀 ✿</Text>
              <AccountPickerField value={accountPickerIndex} onChange={setAccountPickerIndex} />
            </View>

            <View className="flex flex-col gap-2">
              <Text className="text-xs font-medium" style={{ color: '#4A6670' }}>悄悄暗语 ❋</Text>
              <PasswordField value={password} onChange={setPasswordStable} />
            </View>

            <Button
              className="mt-2 w-full rounded-full font-semibold text-white"
              style={{
                height: px(96),
                lineHeight: px(96),
                fontSize: px(30),
                background: submitting ? '#A0AF84' : '#668F80',
                letterSpacing: '0.04em',
              }}
              loading={submitting}
              disabled={submitting}
              onClick={handleSubmit}
            >
              进入小站
            </Button>
          </View>
        </Form>

        <View className="mt-5 flex flex-row items-center justify-center gap-1">
          <Text style={{ fontSize: px(24), color: '#C3B59F' }}>✦</Text>
          <Text className="text-xs" style={{ color: '#A0AF84' }}>只属于我们两个人的地方</Text>
          <Text style={{ fontSize: px(24), color: '#C3B59F' }}>✦</Text>
        </View>
      </View>
    </View>
  )
}
