import { Button, Form, Image, Input, Text, Textarea, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { BIO_MAX, NICKNAME_MAX, UPLOAD_MAX_SIZE_BYTES } from '@momoya/shared'
import { resolveAssetUrl } from '../../../config'
import { useRemoteImage } from '../../../hooks/useRemoteImage'
import { ApiError } from '../../../services/request'
import { uploadImage } from '../../../services/upload'
import { userApi } from '../../../services/user'
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
const TEXTAREA_PLACEHOLDER_STYLE = 'color:#C3B59F;font-size:16px;'

export default function EditProfile() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [avatar, setAvatar] = useState(user?.avatar ?? '')
  const [localPreview, setLocalPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useLoad(() => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  const remoteAvatarUrl = useMemo(
    () => (localPreview ? '' : resolveAssetUrl(avatar)),
    [localPreview, avatar],
  )
  const downloadedSrc = useRemoteImage(remoteAvatarUrl)
  const avatarSrc = localPreview || downloadedSrc

  const dirty = useMemo(() => {
    if (!user) return false
    return (
      nickname.trim() !== (user.nickname ?? '') ||
      bio !== (user.bio ?? '') ||
      avatar !== (user.avatar ?? '')
    )
  }, [user, nickname, bio, avatar])

  const pickAndUploadAvatar = async () => {
    let tempPath: string
    let sizeHint: number | undefined
    try {
      const picked = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })
      const file = picked.tempFiles?.[0]
      if (!file) return
      tempPath = file.tempFilePath
      sizeHint = file.size
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('cancel') || msg.includes('fail cancel')) return
      Taro.showToast({ title: '选图失败', icon: 'none' })
      return
    }

    if (sizeHint && sizeHint > UPLOAD_MAX_SIZE_BYTES) {
      Taro.showToast({ title: '图片过大（≤ 5MB）', icon: 'none' })
      return
    }

    setLocalPreview(tempPath)
    setUploading(true)
    Taro.showLoading({ title: '上传中…', mask: true })
    try {
      const res = await uploadImage(tempPath)
      setAvatar(res.url)
      Taro.hideLoading()
      Taro.showToast({ title: '头像已更新，记得保存', icon: 'none' })
    } catch (e) {
      setLocalPreview('')
      Taro.hideLoading()
      const msg =
        e instanceof ApiError ? e.msg : e instanceof Error ? e.message : '上传失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    const trimmedNickname = nickname.trim()
    if (trimmedNickname.length < 1) {
      Taro.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    if (trimmedNickname.length > NICKNAME_MAX) {
      Taro.showToast({ title: `昵称最长 ${NICKNAME_MAX} 字`, icon: 'none' })
      return
    }
    if (bio.length > BIO_MAX) {
      Taro.showToast({ title: `签名最长 ${BIO_MAX} 字`, icon: 'none' })
      return
    }
    if (!dirty) {
      Taro.navigateBack()
      return
    }

    setSubmitting(true)
    Taro.showLoading({ title: '保存中…', mask: true })
    try {
      const patch: { nickname?: string; bio?: string; avatar?: string } = {}
      if (trimmedNickname !== (user?.nickname ?? '')) patch.nickname = trimmedNickname
      if (bio !== (user?.bio ?? '')) patch.bio = bio
      if (avatar !== (user?.avatar ?? '')) patch.avatar = avatar

      const updated = await userApi.updateMe(patch)
      setUser(updated)
      Taro.hideLoading()
      showToastThen(
        { title: '已保存', icon: 'success' },
        () => {
          void Taro.navigateBack()
        },
        { delayMs: 500 },
      )
    } catch (e) {
      Taro.hideLoading()
      const msg = e instanceof ApiError ? e.msg : e instanceof Error ? e.message : '保存失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View
      className="min-h-screen px-5 pt-6 pb-10"
      style={{ backgroundColor: 'rgba(195,181,159,0.18)' }}
    >
      <Form className="w-full">
        {/* 头像 */}
        <View className="mb-6 flex flex-col items-center">
          <View
            className="relative overflow-hidden rounded-full bg-white"
            style={{
              width: px(192),
              height: px(192),
              border: `3px solid #668F80`,
              boxShadow: `0 0 0 5px rgba(102,143,128,0.18)`,
            }}
            onClick={uploading ? undefined : pickAndUploadAvatar}
          >
            {avatarSrc ? (
              <Image src={avatarSrc} className="h-full w-full" mode="aspectFill" />
            ) : (
              <View className="flex h-full w-full items-center justify-center">
                <Text style={{ fontSize: px(64), color: '#D6A2AD' }}>♡</Text>
              </View>
            )}
            <View
              className="absolute inset-x-0 bottom-0 py-1 text-center"
              style={{ backgroundColor: 'rgba(102,143,128,0.75)' }}
            >
              <Text style={{ fontSize: px(22), color: '#fff' }}>
                {uploading ? '上传中…' : '点击换头像'}
              </Text>
            </View>
          </View>
        </View>

        {/* 表单卡片 */}
        <View
          className="rounded-2xl bg-white px-5 py-5"
          style={{
            border: '1px solid rgba(195,181,159,0.5)',
            boxShadow: `0 ${px(4)} ${px(24)} rgba(74,102,112,0.07)`,
          }}
        >
          {/* 昵称 */}
          <View className="flex flex-col gap-2">
            <View className="flex items-center justify-between">
              <Text className="text-xs font-medium" style={{ color: '#4A6670' }}>昵称 ✿</Text>
              <Text style={{ fontSize: px(22), color: '#C3B59F' }}>
                {nickname.length}/{NICKNAME_MAX}
              </Text>
            </View>
            <View
              className="flex h-12 flex-row items-center overflow-hidden rounded-2xl"
              style={{ background: 'rgba(195,181,159,0.12)', border: '1px solid rgba(102,143,128,0.45)' }}
            >
              <Input
                className="flex-1"
                style={INPUT_INNER_STYLE}
                value={nickname}
                placeholder="给自己起个可爱的名字"
                placeholderClass="page-input-placeholder"
                placeholderStyle={PLACEHOLDER_STYLE}
                maxlength={NICKNAME_MAX}
                onInput={(e) => setNickname(e.detail.value)}
              />
            </View>
          </View>

          <View className="mt-5 flex flex-col gap-2">
            <View className="flex items-center justify-between">
              <Text className="text-xs font-medium" style={{ color: '#4A6670' }}>签名 ⊹</Text>
              <Text style={{ fontSize: px(22), color: '#C3B59F' }}>
                {bio.length}/{BIO_MAX}
              </Text>
            </View>
            <View
              className="overflow-hidden rounded-2xl px-4 py-3"
              style={{ background: 'rgba(195,181,159,0.12)', border: '1px solid rgba(102,143,128,0.45)' }}
            >
              <Textarea
                className="w-full"
                style={{ fontSize: px(32), color: '#4A6670', minHeight: px(160) }}
                value={bio}
                placeholder="最近的心情 / 想说的话"
                placeholderClass="textarea-placeholder"
                placeholderStyle={TEXTAREA_PLACEHOLDER_STYLE}
                maxlength={BIO_MAX}
                onInput={(e) => setBio(e.detail.value)}
                autoHeight
              />
            </View>
          </View>
        </View>

        {/* 保存按钮 */}
        <Button
          className="mt-5 w-full rounded-full font-semibold text-white"
          style={{
            height: px(96),
            lineHeight: px(96),
            fontSize: px(30),
            background: submitting || uploading ? '#A0AF84' : '#668F80',
            letterSpacing: '0.04em',
          }}
          loading={submitting}
          disabled={submitting || uploading}
          onClick={handleSubmit}
        >
          保存 ✦
        </Button>

        <Text
          className="mt-3 block text-center"
          style={{ fontSize: px(22), color: '#C3B59F' }}
        >
          头像支持 jpeg / png / webp，单张 ≤ 5 MB
        </Text>
      </Form>
    </View>
  )
}
