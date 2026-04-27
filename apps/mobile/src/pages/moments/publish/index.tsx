import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import type { CreatePostInputDto, UpdatePostInputDto } from '@momoya/shared'
import {
  DAILY_TAG_MAX_PER_POST,
  POST_IMAGE_MAX as IMAGE_MAX,
  POST_TEXT_MAX as TEXT_MAX,
  UPLOAD_MAX_SIZE_BYTES,
} from '@momoya/shared'
import { EditPostSlotImage } from '../../../components/EditPostSlotImage'
import TagChip from '../../../components/TagChip'
import { postApi } from '../../../services/post'
import { ApiError } from '../../../services/request'
import { uploadImage } from '../../../services/upload'
import { useAuthStore } from '../../../store/authStore'
import { useDailyStore } from '../../../store/postFeedStore'
import { parseTagInput } from '../../../utils/tagInput'
import { previewPostImages } from '../../../utils/previewPostImages'
import { showToastThen } from '../../../utils/showToastThen'
import { formatAbsolute } from '../../../utils/time'

const px = (n: number) => Taro.pxTransform(n)

const TEXTAREA_PLACEHOLDER_STYLE = 'color:#C3B59F;font-size:16px;'
const TAG_INPUT_PLACEHOLDER_STYLE = 'color:#C3B59F;font-size:14px;'

interface Slot {
  localPath: string
  remoteUrl: string | null
  uploading: boolean
  failed: boolean
}

const pad2 = (n: number) => String(n).padStart(2, '0')
function toDateValue(d: Date | null): string {
  if (!d) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function toTimeValue(d: Date | null): string {
  if (!d) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export default function PublishDaily() {
  const router = useRouter()
  const editingId = router.params.id
  const isEditing = !!editingId

  const [text, setText] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [tagInput, setTagInput] = useState('')
  const [happenedAt, setHappenedAt] = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingPost, setLoadingPost] = useState(false)

  const prepend = useDailyStore((s) => s.prepend)
  const updateOne = useDailyStore((s) => s.updateOne)

  useLoad(() => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  useEffect(() => {
    if (!editingId) return
    setLoadingPost(true)
    postApi
      .detail(editingId)
      .then((p) => {
        if (p.type !== 'daily') {
          showToastThen(
            { title: '类型不匹配', icon: 'none' },
            () => {
              void Taro.navigateBack()
            },
            { delayMs: 500 },
          )
          return
        }
        setText(p.text)
        setTagInput(p.tags.join(','))
        setHappenedAt(new Date(p.happenedAt))
        setSlots(
          p.images.map((url) => ({
            localPath: url,
            remoteUrl: url,
            uploading: false,
            failed: false,
          })),
        )
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.msg : '加载失败'
        showToastThen(
          { title: msg, icon: 'none' },
          () => {
            void Taro.navigateBack()
          },
          { delayMs: 500 },
        )
      })
      .finally(() => setLoadingPost(false))
  }, [editingId])

  const parsedTags = useMemo(() => parseTagInput(tagInput), [tagInput])
  const canAddMore = slots.length < IMAGE_MAX
  const anyUploading = slots.some((s) => s.uploading)
  const tagOverflow = parsedTags.length > DAILY_TAG_MAX_PER_POST
  const canSubmit = useMemo(() => {
    if (submitting || anyUploading || loadingPost) return false
    if (tagOverflow) return false
    const hasText = text.trim().length > 0
    const hasImages = slots.some((s) => !!s.remoteUrl)
    return hasText || hasImages
  }, [submitting, anyUploading, loadingPost, tagOverflow, text, slots])

  const handlePickImages = async () => {
    const remain = IMAGE_MAX - slots.length
    if (remain <= 0) return
    let picked: { tempFilePath: string; size?: number }[]
    try {
      const res = await Taro.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })
      picked = (res.tempFiles ?? []).map((f) => ({ tempFilePath: f.tempFilePath, size: f.size }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('cancel')) return
      Taro.showToast({ title: '选图失败', icon: 'none' })
      return
    }

    const newSlots: Slot[] = picked
      .filter((p) => {
        if (p.size && p.size > UPLOAD_MAX_SIZE_BYTES) {
          Taro.showToast({ title: '有图片超过 5 MB，已跳过', icon: 'none' })
          return false
        }
        return true
      })
      .map((p) => ({ localPath: p.tempFilePath, remoteUrl: null, uploading: true, failed: false }))

    if (newSlots.length === 0) return
    setSlots((prev) => [...prev, ...newSlots])

    await Promise.all(
      newSlots.map(async (slot) => {
        try {
          const res = await uploadImage(slot.localPath)
          setSlots((prev) =>
            prev.map((s) =>
              s.localPath === slot.localPath
                ? { ...s, remoteUrl: res.url, uploading: false, failed: false }
                : s,
            ),
          )
        } catch (err) {
          const msg = err instanceof ApiError ? err.msg : err instanceof Error ? err.message : '上传失败'
          Taro.showToast({ title: msg, icon: 'none' })
          setSlots((prev) =>
            prev.map((s) =>
              s.localPath === slot.localPath
                ? { ...s, uploading: false, failed: true }
                : s,
            ),
          )
        }
      }),
    )
  }

  const handleRemoveSlot = (localPath: string) => {
    setSlots((prev) => prev.filter((s) => s.localPath !== localPath))
  }

  const handlePreviewSlot = (index: number) => {
    const rels = slots.map((s) => (s.remoteUrl != null && s.remoteUrl !== '' ? s.remoteUrl : s.localPath))
    void previewPostImages(rels, index)
  }

  const handleRemoveTag = (t: string) => {
    const next = parsedTags.filter((x) => x !== t)
    setTagInput(next.join(','))
  }

  const handleSubmit = async () => {
    const trimmed = text.trim()
    const images = slots.filter((s) => s.remoteUrl).map((s) => s.remoteUrl!) as string[]
    if (!trimmed && images.length === 0) {
      Taro.showToast({ title: '写点什么或加张图吧', icon: 'none' })
      return
    }
    if (parsedTags.length > DAILY_TAG_MAX_PER_POST) {
      Taro.showToast({ title: `tag 最多 ${DAILY_TAG_MAX_PER_POST} 个`, icon: 'none' })
      return
    }
    if (slots.some((s) => s.failed)) {
      const confirm = await Taro.showModal({
        title: '有图片上传失败',
        content: '失败的图不会被发布，是否继续？',
        confirmColor: '#668F80',
      })
      if (!confirm.confirm) return
    }

    setSubmitting(true)
    Taro.showLoading({ title: isEditing ? '保存中…' : '发布中…', mask: true })
    try {
      if (isEditing && editingId) {
        const payload: UpdatePostInputDto = {
          text: trimmed,
          images,
          tags: parsedTags,
          happenedAt: happenedAt ? happenedAt.toISOString() : undefined,
        }
        const saved = await postApi.update(editingId, payload)
        updateOne(saved)
      } else {
        const payload: CreatePostInputDto = {
          type: 'daily',
          text: trimmed || undefined,
          images: images.length > 0 ? images : undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
          happenedAt: happenedAt ? happenedAt.toISOString() : undefined,
        }
        const created = await postApi.create(payload)
        prepend(created)
      }
      Taro.hideLoading()
      showToastThen(
        { title: isEditing ? '已保存' : '已发布', icon: 'success' },
        () => {
          void Taro.navigateBack()
        },
        { delayMs: 500 },
      )
    } catch (err) {
      Taro.hideLoading()
      const msg = err instanceof ApiError ? err.msg : err instanceof Error ? err.message : '发布失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View
      className="min-h-screen px-4 pb-10 pt-4"
      style={{ backgroundColor: 'rgba(195,181,159,0.18)' }}
    >
      {/* 正文 + 图片 */}
      <View
        className="rounded-2xl bg-white p-4"
        style={{
          border: '1px solid rgba(195,181,159,0.5)',
          boxShadow: `0 ${px(4)} ${px(20)} rgba(74,102,112,0.07)`,
        }}
      >
        <View className="mb-1 flex items-center gap-1">
          <Text style={{ fontSize: px(24), color: '#A0AF84' }}>✿</Text>
          <Text className="text-xs font-medium" style={{ color: '#668F80' }}>记录今天</Text>
        </View>
        <Textarea
          className="w-full"
          style={{
            fontSize: px(32),
            lineHeight: px(48),
            color: '#4A6670',
            minHeight: px(200),
          }}
          value={text}
          placeholder="记录今天的一点小事…"
          placeholderClass="textarea-placeholder"
          placeholderStyle={TEXTAREA_PLACEHOLDER_STYLE}
          maxlength={TEXT_MAX}
          onInput={(e) => setText(e.detail.value)}
          autoHeight
        />
        <View className="flex items-center justify-end mt-1">
          <Text style={{ fontSize: px(22), color: '#C3B59F' }}>{text.length}/{TEXT_MAX}</Text>
        </View>

        {/* 图片格 */}
        <View className="mt-2 grid grid-cols-3 gap-2">
          {slots.map((slot, idx) => (
            <View
              key={slot.localPath}
              className="relative aspect-square overflow-hidden rounded-xl"
              style={{ backgroundColor: 'rgba(195,181,159,0.15)' }}
            >
              <View
                className="h-full w-full"
                onClick={() => handlePreviewSlot(idx)}
                catchMove
              >
                <EditPostSlotImage slot={slot} />
              </View>
              {slot.uploading ? (
                <View
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(74,102,112,0.45)' }}
                >
                  <Text style={{ fontSize: px(22), color: '#fff' }}>上传中</Text>
                </View>
              ) : null}
              {slot.failed ? (
                <View
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(214,162,173,0.7)' }}
                >
                  <Text style={{ fontSize: px(22), color: '#fff' }}>失败</Text>
                </View>
              ) : null}
              <View
                className="absolute right-1 top-1 flex items-center justify-center rounded-full"
                style={{
                  width: px(40),
                  height: px(40),
                  backgroundColor: 'rgba(74,102,112,0.55)',
                }}
                onClick={() => handleRemoveSlot(slot.localPath)}
              >
                <Text style={{ fontSize: px(24), lineHeight: px(24), color: '#fff' }}>×</Text>
              </View>
            </View>
          ))}
          {canAddMore ? (
            <View
              className="flex aspect-square items-center justify-center rounded-xl"
              style={{
                border: '1.5px dashed rgba(102,143,128,0.45)',
                backgroundColor: 'rgba(195,181,159,0.08)',
              }}
              onClick={handlePickImages}
            >
              <Text style={{ fontSize: px(56), color: '#C3B59F', lineHeight: px(56) }}>+</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: px(22), color: '#C3B59F', marginTop: px(8) }}>
          最多 {IMAGE_MAX} 张，单张 ≤ 5 MB；仅你和 TA 可见
        </Text>
      </View>

      {/* Tags */}
      <View
        className="mt-3 rounded-2xl bg-white p-4"
        style={{
          border: '1px solid rgba(195,181,159,0.5)',
          boxShadow: `0 ${px(4)} ${px(20)} rgba(74,102,112,0.07)`,
        }}
      >
        <View className="mb-2 flex items-center gap-1">
          <Text style={{ fontSize: px(24), color: '#A0AF84' }}>⊹</Text>
          <Text className="text-xs font-medium" style={{ color: '#668F80' }}>标签</Text>
        </View>
        <View
          className="flex h-10 flex-row items-center overflow-hidden rounded-2xl"
          style={{ background: 'rgba(195,181,159,0.12)', border: '1px solid rgba(102,143,128,0.35)' }}
        >
          <Input
            className="flex-1"
            style={{ paddingLeft: px(28), paddingRight: px(28), fontSize: px(28), color: '#4A6670' }}
            value={tagInput}
            placeholder="用 , 分隔；例：吃饭,约会,电影"
            placeholderClass="page-input-placeholder"
            placeholderStyle={TAG_INPUT_PLACEHOLDER_STYLE}
            onInput={(e) => setTagInput(e.detail.value)}
          />
        </View>
        {parsedTags.length > 0 ? (
          <View className="mt-2 flex flex-wrap gap-1.5">
            {parsedTags.map((t) => (
              <TagChip key={t} name={t} removable onRemove={() => handleRemoveTag(t)} />
            ))}
          </View>
        ) : null}
        <Text
          className="mt-1"
          style={{ fontSize: px(22), color: tagOverflow ? '#D6A2AD' : '#C3B59F' }}
        >
          {parsedTags.length}/{DAILY_TAG_MAX_PER_POST}
        </Text>
      </View>

      {/* 发生时间 */}
      <View
        className="mt-3 rounded-2xl bg-white p-4"
        style={{
          border: '1px solid rgba(195,181,159,0.5)',
          boxShadow: `0 ${px(4)} ${px(20)} rgba(74,102,112,0.07)`,
        }}
      >
        <View className="mb-2 flex items-center gap-1">
          <Text style={{ fontSize: px(24), color: '#A0AF84' }}>✦</Text>
          <Text className="text-xs font-medium" style={{ color: '#668F80' }}>发生时间</Text>
        </View>
        <View className="flex flex-wrap items-center gap-2">
          <Picker
            mode="date"
            value={toDateValue(happenedAt)}
            onChange={(e) => {
              const datePart = String(e.detail.value ?? '')
              const [y, m, d] = datePart.split('-').map((x) => Number(x))
              if (!y || !m || !d) return
              const base = happenedAt ? new Date(happenedAt) : new Date()
              base.setFullYear(y)
              base.setMonth(m - 1)
              base.setDate(d)
              setHappenedAt(base)
            }}
          >
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: 'rgba(102,143,128,0.12)', border: '1px solid rgba(102,143,128,0.35)' }}
            >
              <Text style={{ fontSize: px(26), color: '#668F80' }}>
                {happenedAt ? formatAbsolute(happenedAt.toISOString()) : '默认 = 现在'}
              </Text>
            </View>
          </Picker>
          <Picker
            mode="time"
            value={toTimeValue(happenedAt)}
            onChange={(e) => {
              const timePart = String(e.detail.value ?? '')
              const [hh, mm] = timePart.split(':').map((x) => Number(x))
              if (Number.isNaN(hh) || Number.isNaN(mm)) return
              const base = happenedAt ? new Date(happenedAt) : new Date()
              base.setHours(hh)
              base.setMinutes(mm)
              setHappenedAt(base)
            }}
          >
            <View
              className="rounded-full px-3 py-1"
              style={{ border: '1px solid rgba(195,181,159,0.6)', backgroundColor: 'transparent' }}
            >
              <Text style={{ fontSize: px(26), color: '#4A6670' }}>改时间</Text>
            </View>
          </Picker>
          {happenedAt ? (
            <View
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: 'rgba(195,181,159,0.2)' }}
              onClick={() => setHappenedAt(null)}
            >
              <Text style={{ fontSize: px(24), color: '#C3B59F' }}>清除</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: px(22), color: '#C3B59F', marginTop: px(8) }}>
          不选则以发布时间为准；适合补记昨天的日常。
        </Text>
      </View>

      {/* 发布按钮 */}
      <Button
        className="mt-5 w-full rounded-full font-semibold text-white"
        style={{
          height: px(96),
          lineHeight: px(96),
          fontSize: px(30),
          background: canSubmit ? '#668F80' : '#C3B59F',
          letterSpacing: '0.04em',
        }}
        loading={submitting}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {isEditing ? '保存 ✦' : '发布 ✦'}
      </Button>
    </View>
  )
}
