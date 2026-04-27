import { Button, Form, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { ErrorKey, PASSWORD_MIN } from '@momoya/shared'
import { authApi } from '../../../services/auth'
import { ApiError } from '../../../services/request'
import { useAuthStore } from '../../../store/authStore'
import { showToastThen } from '../../../utils/showToastThen'

const px = (n: number) => Taro.pxTransform(n)

const INPUT_INNER_STYLE = {
  paddingLeft: px(32),
  paddingRight: px(32),
  height: px(96),
  fontSize: px(32),
  lineHeight: px(96),
  color: '#4A6670',
} as const

const PLACEHOLDER_STYLE = 'color:#C3B59F;font-size:16px;line-height:48px;'

const FIELDS = [
  { key: 'old', label: '当前密码 ❋', placeholder: '请输入当前密码' },
  { key: 'new', label: '新密码 ✿', placeholder: `${PASSWORD_MIN}–64 位` },
  { key: 'confirm', label: '确认新密码 ⊹', placeholder: '再次输入新密码' },
] as const

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setTokens = useAuthStore((s) => s.setTokens)

  const validate = (): string | null => {
    if (oldPassword.length < PASSWORD_MIN) return `旧密码至少 ${PASSWORD_MIN} 位`
    if (newPassword.length < PASSWORD_MIN) return `新密码至少 ${PASSWORD_MIN} 位`
    if (newPassword === oldPassword) return '新密码不能与旧密码相同'
    if (newPassword !== confirmPassword) return '两次输入的新密码不一致'
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      Taro.showToast({ title: err, icon: 'none' })
      return
    }
    setSubmitting(true)
    Taro.showLoading({ title: '提交中…', mask: true })
    try {
      const result = await authApi.changePassword({ oldPassword, newPassword })
      setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessExpiresIn: result.accessExpiresIn,
        refreshExpiresIn: result.refreshExpiresIn,
      })
      Taro.hideLoading()
      showToastThen(
        { title: '修改成功', icon: 'success' },
        () => {
          void Taro.navigateBack()
        },
        { delayMs: 600 },
      )
    } catch (e) {
      Taro.hideLoading()
      if (e instanceof ApiError && e.errorKey === ErrorKey.E_AUTH_WRONG_OLD_PASSWORD) {
        Taro.showToast({ title: '旧密码不正确', icon: 'none' })
      } else {
        const msg = e instanceof ApiError ? e.msg : e instanceof Error ? e.message : '修改失败'
        Taro.showToast({ title: msg, icon: 'none' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const values = { old: oldPassword, new: newPassword, confirm: confirmPassword }
  const setters = {
    old: setOldPassword,
    new: setNewPassword,
    confirm: setConfirmPassword,
  }

  return (
    <View
      className="min-h-screen px-5 pt-6 pb-10"
      style={{ backgroundColor: 'rgba(195,181,159,0.18)' }}
    >
      <Form className="w-full">
        <View
          className="rounded-2xl bg-white px-5 py-5"
          style={{
            border: '1px solid rgba(195,181,159,0.5)',
            boxShadow: `0 ${px(4)} ${px(24)} rgba(74,102,112,0.07)`,
          }}
        >
          {FIELDS.map((field, idx) => (
            <View key={field.key} className={idx > 0 ? 'mt-5' : ''}>
              <Text
                className="mb-2 block text-xs font-medium"
                style={{ color: '#4A6670' }}
              >
                {field.label}
              </Text>
              <View
                className="flex h-12 flex-row items-center overflow-hidden rounded-2xl"
                style={{ background: 'rgba(195,181,159,0.12)', border: '1px solid rgba(102,143,128,0.45)' }}
              >
                <Input
                  className="flex-1"
                  style={INPUT_INNER_STYLE}
                  password
                  placeholder={field.placeholder}
                  placeholderClass="page-input-placeholder"
                  placeholderStyle={PLACEHOLDER_STYLE}
                  value={values[field.key]}
                  onInput={(e) => setters[field.key](e.detail.value)}
                  maxlength={64}
                />
              </View>
            </View>
          ))}
        </View>

        <Button
          className="mt-5 w-full rounded-full font-semibold text-white"
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
          确认修改 ✦
        </Button>

        <Text
          className="mt-3 block text-center"
          style={{ fontSize: px(22), color: '#C3B59F' }}
        >
          修改成功后其他已登录设备将自动下线
        </Text>
      </Form>
    </View>
  )
}
