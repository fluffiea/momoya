import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import type {
  CreatePostInputDto,
  TagDto,
  UpdatePostInputDto,
} from '@momoya/shared'
import {
  POST_IMAGE_MAX as IMAGE_MAX,
  POST_TEXT_MAX as TEXT_MAX,
  REPORT_TAG_MAX,
  REPORT_TAG_MIN,
  TAG_NAME_MAX,
  UPLOAD_MAX_SIZE_BYTES,
  USER_TAG_PER_USER_LIMIT,
} from '@momoya/shared'
import { EditPostSlotImage } from '../../../components/EditPostSlotImage'
import TagChip from '../../../components/TagChip'
import { postApi } from '../../../services/post'
import { ApiError } from '../../../services/request'
import { tagApi } from '../../../services/tag'
import { uploadImage } from '../../../services/upload'
import { useAuthStore } from '../../../store/authStore'
import { useReportStore } from '../../../store/postFeedStore'
import { formatAbsolute } from '../../../utils/time'
import { previewPostImages } from '../../../utils/previewPostImages'
import { showToastThen } from '../../../utils/showToastThen'

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

export default function PublishReport() {
  const router = useRouter()
  const editingId = router.params.id
  const isEditing = !!editingId

  const [text, setText] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [happenedAt, setHappenedAt] = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingPost, setLoadingPost] = useState(false)

  const [availableTags, setAvailableTags] = useState<TagDto[]>([])
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [customAdding, setCustomAdding] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const prepend = useReportStore((s) => s.prepend)
  const updateOne = useReportStore((s) => s.updateOne)

  useLoad(() => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  const loadTags = async () => {
    try {
      const res = await tagApi.list()
      setAvailableTags(res.items)
    } catch (err) {
      const msg = err instanceof ApiError ? err.msg : '加载 tag 失败'
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }

  useEffect(() => { void loadTags() }, [])

  useEffect(() => {
    if (!editingId) return
    setLoadingPost(true)
    postApi
      .detail(editingId)
      .then((p) => {
        if (p.type !== 'report') {
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
        setSelectedTags(new Set(p.tags))
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

  const canAddMore = slots.length < IMAGE_MAX
  const anyUploading = slots.some((s) => s.uploading)

  const customTagCount = useMemo(
    () => availableTags.filter((t) => t.source === 'custom').length,
    [availableTags],
  )
  const selectedArray = useMemo(() => Array.from(selectedTags), [selectedTags])

  const canSubmit = useMemo(() => {
    if (submitting || anyUploading || loadingPost) return false
    if (selectedTags.size < REPORT_TAG_MIN || selectedTags.size > REPORT_TAG_MAX) return false
    const hasText = text.trim().length > 0
    const hasImages = slots.some((s) => !!s.remoteUrl)
    return hasText || hasImages
  }, [submitting, anyUploading, loadingPost, selectedTags, text, slots])

  const toggleTag = (name: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        if (next.size >= REPORT_TAG_MAX) {
          Taro.showToast({ title: `最多选 ${REPORT_TAG_MAX} 个`, icon: 'none' })
          return prev
        }
        next.add(name)
      }
      return next
    })
  }

  const handleLongPressTag = async (t: TagDto) => {
    if (t.source !== 'custom') return
    const confirm = await Taro.showModal({
      title: `删除自定义 tag "${t.name}"`,
      content: '历史报备里已存的 tag 会保留，但不再可选。',
      confirmColor: '#668F80',
    })
    if (!confirm.confirm) return
    try {
      await tagApi.remove(t.name)
      setAvailableTags((prev) => prev.filter((x) => x.name !== t.name))
      setSelectedTags((prev) => {
        if (!prev.has(t.name)) return prev
        const next = new Set(prev)
        next.delete(t.name)
        return next
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.msg : '删除失败'
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }

  const handleCommitCustom = async () => {
    const name = customInput.trim()
    if (!name) { setCustomAdding(false); return }
    if (name.length > TAG_NAME_MAX) {
      Taro.showToast({ title: `名称最多 ${TAG_NAME_MAX} 字`, icon: 'none' })
      return
    }
    if (customTagCount >= USER_TAG_PER_USER_LIMIT) {
      Taro.showToast({ title: `自定义 tag 已达上限（${USER_TAG_PER_USER_LIMIT}）`, icon: 'none' })
      return
    }
    try {
      const created = await tagApi.create({ name })
      setAvailableTags((prev) => [...prev, created])
      setSelectedTags((prev) => {
        if (prev.has(created.name)) return prev
        if (prev.size >= REPORT_TAG_MAX) return prev
        const next = new Set(prev)
        next.add(created.name)
        return next
      })
      setCustomInput('')
      setCustomAdding(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.msg : '新增失败'
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }

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

  const handleSubmit = async () => {
    const trimmed = text.trim()
    const images = slots.filter((s) => s.remoteUrl).map((s) => s.remoteUrl!) as string[]
    if (!trimmed && images.length === 0) {
      Taro.showToast({ title: '写点什么或加张图吧', icon: 'none' })
      return
    }
    if (selectedTags.size < REPORT_TAG_MIN) {
      Taro.showToast({ title: `至少选 ${REPORT_TAG_MIN} 个 tag`, icon: 'none' })
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
          tags: selectedArray,
          happenedAt: happenedAt ? happenedAt.toISOString() : undefined,
        }
        const saved = await postApi.update(editingId, payload)
        updateOne(saved)
      } else {
        const payload: CreatePostInputDto = {
          type: 'report',
          text: trimmed || undefined,
          images: images.length > 0 ? images : undefined,
          tags: selectedArray,
          happenedAt: happenedAt ? happenedAt.toISOString() : undefined,
        }
        const created = await postApi.create(payload)
        prepend(created)
      }
      Taro.hideLoading()
      showToastThen(
        { title: isEditing ? '已保存' : '已报备', icon: 'success' },
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
          <Text style={{ fontSize: px(24), color: '#A0AF84' }}>✦</Text>
          <Text className="text-xs font-medium" style={{ color: '#668F80' }}>报备内容</Text>
        </View>
        <Textarea
          className="w-full"
          style={{
            fontSize: px(32),
            lineHeight: px(48),
            color: '#4A6670',
            minHeight: px(180),
          }}
          value={text}
          placeholder="报备一下今天的去向…"
          placeholderClass="textarea-placeholder"
          placeholderStyle={TEXTAREA_PLACEHOLDER_STYLE}
          maxlength={TEXT_MAX}
          onInput={(e) => setText(e.detail.value)}
          autoHeight
        />
        <View className="flex items-center justify-end mt-1">
          <Text style={{ fontSize: px(22), color: '#C3B59F' }}>{text.length}/{TEXT_MAX}</Text>
        </View>

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
          最多 {IMAGE_MAX} 张，单张 ≤ 5 MB
        </Text>
      </View>

      {/* Tags 选择 */}
      <View
        className="mt-3 rounded-2xl bg-white p-4"
        style={{
          border: '1px solid rgba(195,181,159,0.5)',
          boxShadow: `0 ${px(4)} ${px(20)} rgba(74,102,112,0.07)`,
        }}
      >
        <View className="mb-2 flex items-center justify-between">
          <View className="flex items-center gap-1">
            <Text style={{ fontSize: px(24), color: '#A0AF84' }}>⊹</Text>
            <Text className="text-xs font-medium" style={{ color: '#668F80' }}>选择 tag</Text>
          </View>
          <Text style={{ fontSize: px(22), color: '#C3B59F' }}>
            {selectedTags.size}/{REPORT_TAG_MAX}（至少 {REPORT_TAG_MIN}）
          </Text>
        </View>
        <View className="flex flex-wrap gap-2">
          {availableTags.map((t) => (
            <View key={t.name} onLongPress={() => void handleLongPressTag(t)}>
              <TagChip
                name={t.name}
                size="md"
                selected={selectedTags.has(t.name)}
                onTap={() => toggleTag(t.name)}
              />
            </View>
          ))}
          {customAdding ? (
            <View
              className="flex items-center gap-1 rounded-full px-3 py-1"
              style={{ backgroundColor: 'rgba(195,181,159,0.2)', border: '1px solid rgba(102,143,128,0.35)' }}
            >
              <Input
                className="min-w-[80px]"
                style={{ fontSize: px(26), color: '#668F80' }}
                value={customInput}
                placeholder="新 tag"
                placeholderClass="page-input-placeholder"
                placeholderStyle={TAG_INPUT_PLACEHOLDER_STYLE}
                maxlength={TAG_NAME_MAX}
                focus
                onInput={(e) => setCustomInput(e.detail.value)}
                onConfirm={() => void handleCommitCustom()}
                onBlur={() => void handleCommitCustom()}
              />
            </View>
          ) : (
            <View
              className="rounded-full px-3 py-1"
              style={{
                border: '1.5px dashed rgba(160,175,132,0.6)',
                backgroundColor: 'transparent',
              }}
              onClick={() => { setCustomInput(''); setCustomAdding(true) }}
            >
              <Text style={{ fontSize: px(26), color: '#A0AF84' }}>+ 自定义</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: px(22), color: '#C3B59F', marginTop: px(8) }}>
          长按自定义 tag 可删除；最多保留 {USER_TAG_PER_USER_LIMIT} 个。
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
              style={{ border: '1px solid rgba(195,181,159,0.6)' }}
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
      </View>

      {/* 报备按钮 */}
      <Button
        className="mt-5 w-full rounded-full font-semibold text-white"
        style={{
          height: px(96),
          lineHeight: px(96),
          fontSize: px(30),
          background: canSubmit ? '#A0AF84' : '#C3B59F',
          letterSpacing: '0.04em',
        }}
        loading={submitting}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {isEditing ? '保存 ✦' : '报备 ✦'}
      </Button>
    </View>
  )
}
