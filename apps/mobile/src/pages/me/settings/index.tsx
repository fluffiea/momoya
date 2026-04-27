import { Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AnniversaryDto, PartnerBriefDto } from '@momoya/shared'
import {
  DEFAULT_REPORT_LIST_FILTER,
  DEFAULT_WITNESS_TAB,
  REPORT_LIST_FILTER_OPTIONS,
  WITNESS_DEFAULT_TAB_OPTIONS,
  type ReportFilter,
  type WitnessDefaultTab,
} from '@momoya/shared'
import { anniversaryApi } from '../../../services/anniversary'
import { ApiError } from '../../../services/request'
import { userApi } from '../../../services/user'
import { useAuthStore } from '../../../store/authStore'
import {
  datetimeLocalPickerValueToUtcIso,
  isoToDatetimeLocalPickerValue,
} from '../../../utils/anniversary'
import { formatAbsolute } from '../../../utils/time'

const px = (n: number) => Taro.pxTransform(n)

type Saving =
  | null
  | { kind: 'witnessTab'; value: WitnessDefaultTab }
  | { kind: 'reportFilter'; value: ReportFilter }
  | { kind: 'togetherDate' }

function splitLocalDateTimeFromIso(iso: string): { d: string; t: string } {
  const combined = isoToDatetimeLocalPickerValue(iso)
  const i = combined.indexOf(' ')
  if (i < 0) return { d: combined, t: '00:00' }
  const d = combined.slice(0, i)
  const t = combined.slice(i + 1).trim() || '00:00'
  return { d, t }
}

function nicknameForEditor(
  editorId: string | null,
  meId: string | undefined,
  meNick: string | undefined,
  partner: PartnerBriefDto | null,
): string {
  if (!editorId) return ''
  if (meId && editorId === meId) return meNick ?? '我'
  if (partner && editorId === partner.id) return partner.nickname || '对方'
  return '对方'
}

function SettingsCard({
  sectionTitle,
  title,
  hint,
  sectionTopClassName = 'mb-3 mt-6',
  children,
}: {
  sectionTitle: string
  title: string
  /** 空字符串则不渲染底部说明 */
  hint: string
  /** 第一节用 `mb-3` 即可，避免顶栏下重复大间距 */
  sectionTopClassName?: string
  children: ReactNode
}) {
  return (
    <>
      <View className={`flex items-center gap-2 px-1 ${sectionTopClassName}`}>
        <Text style={{ fontSize: px(24), color: '#A0AF84' }}>⊹</Text>
        <Text className="text-xs font-medium" style={{ color: '#668F80' }}>
          {sectionTitle}
        </Text>
      </View>
      <View
        className="rounded-2xl bg-white p-5"
        style={{
          border: '1px solid rgba(195,181,159,0.5)',
          boxShadow: `0 ${px(4)} ${px(20)} rgba(74,102,112,0.07)`,
        }}
      >
        <Text className="text-sm font-medium" style={{ color: '#4A6670' }}>
          {title}
        </Text>
        {children}
        {hint ? (
          <Text className="mt-3 leading-relaxed" style={{ fontSize: px(22), color: '#C3B59F' }}>
            {hint}
          </Text>
        ) : null}
      </View>
    </>
  )
}

function TogetherPickerColumn({
  mode,
  value,
  displayValue,
  label,
  padL,
  padR,
  onPick,
}: {
  mode: 'date' | 'time'
  value: string
  displayValue: string
  label: string
  padL: number
  padR: number
  onPick: (v: string) => void
}) {
  const labelStyle = {
    fontSize: px(22),
    color: '#A0AF84',
    lineHeight: px(40),
    letterSpacing: px(6),
    marginRight: px(18),
    flexShrink: 0 as const,
  }
  const valueStyle = {
    flex: 1,
    minWidth: 0,
    fontSize: px(30),
    fontWeight: '600' as const,
    color: '#4A6670',
    lineHeight: px(40),
  }
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Picker
        mode={mode}
        value={value}
        style={{ width: '100%' }}
        onChange={(e) => onPick(String(e.detail.value))}
      >
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: px(padL),
            paddingRight: px(padR),
            paddingTop: px(16),
            paddingBottom: px(16),
          }}
        >
          <Text style={labelStyle}>{label}</Text>
          <Text style={valueStyle}>{displayValue}</Text>
        </View>
      </Picker>
    </View>
  )
}

export default function SettingsPage() {
  useLoad(() => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [togetherRow, setTogetherRow] = useState<AnniversaryDto | null>(null)
  const [partnerBrief, setPartnerBrief] = useState<PartnerBriefDto | null>(null)
  const [togetherLoadError, setTogetherLoadError] = useState(false)
  const currentWitnessTab: WitnessDefaultTab =
    user?.settings.defaultWitnessTab ?? DEFAULT_WITNESS_TAB
  const currentReportFilter: ReportFilter =
    user?.settings.defaultReportListFilter ?? DEFAULT_REPORT_LIST_FILTER
  const [saving, setSaving] = useState<Saving>(null)
  const [togetherDraftD, setTogetherDraftD] = useState('')
  const [togetherDraftT, setTogetherDraftT] = useState('00:00')
  const togetherDraftRef = useRef({ d: '', t: '00:00' })
  /** 本页刚保存「在一起」后，跳过下一次 draft 的 useEffect 同步，避免与手动 setState 叠成二次渲染抖动 */
  const skipTogetherDraftEffectOnceRef = useRef(false)

  const busy = saving !== null

  const loadTogetherAnniversary = useCallback(async () => {
    if (!useAuthStore.getState().isAuthed()) return
    setTogetherLoadError(false)
    try {
      const res = await anniversaryApi.list()
      const row = res.items.find((a) => a.isSystem) ?? null
      setTogetherRow((prev) => {
        if (!row && !prev) return null
        if (!row) return null
        if (!prev) return row
        if (
          prev.id === row.id &&
          prev.date === row.date &&
          prev.updatedAt === row.updatedAt &&
          prev.lastDateEditedBy === row.lastDateEditedBy
        ) {
          return prev
        }
        return row
      })
      try {
        const p = await userApi.getPartner()
        setPartnerBrief(p)
      } catch {
        setPartnerBrief(null)
      }
    } catch (err) {
      setTogetherRow(null)
      setPartnerBrief(null)
      if (err instanceof ApiError) {
        if (err.errorKey !== 'E_ANNIV_FORBIDDEN') {
          setTogetherLoadError(true)
        }
      } else {
        setTogetherLoadError(true)
      }
    }
  }, [])

  useDidShow(() => {
    void loadTogetherAnniversary()
  })

  useEffect(() => {
    if (!togetherRow) {
      togetherDraftRef.current = { d: '', t: '00:00' }
      setTogetherDraftD('')
      setTogetherDraftT('00:00')
      return
    }
    if (skipTogetherDraftEffectOnceRef.current) {
      skipTogetherDraftEffectOnceRef.current = false
      return
    }
    const { d, t } = splitLocalDateTimeFromIso(togetherRow.date)
    togetherDraftRef.current = { d, t }
    setTogetherDraftD(d)
    setTogetherDraftT(t)
  }, [togetherRow?.id, togetherRow?.date])

  const saveTogetherMoment = useCallback(
    async (d: string, t: string) => {
      if (!togetherRow || saving !== null) return
      const iso = datetimeLocalPickerValueToUtcIso(`${d} ${t}`)
      if (!iso) {
        Taro.showToast({ title: '时间无效', icon: 'none' })
        const { d: rd, t: rt } = splitLocalDateTimeFromIso(togetherRow.date)
        togetherDraftRef.current = { d: rd, t: rt }
        setTogetherDraftD(rd)
        setTogetherDraftT(rt)
        return
      }
      setSaving({ kind: 'togetherDate' })
      try {
        const updated = await anniversaryApi.update(togetherRow.id, {
          date: iso,
        })
        const { d, t } = splitLocalDateTimeFromIso(updated.date)
        togetherDraftRef.current = { d, t }
        setTogetherDraftD(d)
        setTogetherDraftT(t)
        skipTogetherDraftEffectOnceRef.current = true
        setTogetherRow(updated)
        Taro.showToast({ title: '已保存', icon: 'success' })
      } catch (err) {
        const msg = err instanceof ApiError ? err.msg : '保存失败'
        Taro.showToast({ title: msg, icon: 'none' })
        const { d: rd, t: rt } = splitLocalDateTimeFromIso(togetherRow.date)
        togetherDraftRef.current = { d: rd, t: rt }
        setTogetherDraftD(rd)
        setTogetherDraftT(rt)
      } finally {
        setSaving(null)
      }
    },
    [togetherRow, saving],
  )

  const handlePickWitnessTab = async (next: WitnessDefaultTab) => {
    if (next === currentWitnessTab || busy) return
    setSaving({ kind: 'witnessTab', value: next })
    try {
      const updated = await userApi.updateMe({
        settings: { defaultWitnessTab: next },
      })
      setUser(updated)
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      const msg = err instanceof ApiError ? err.msg : '保存失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setSaving(null)
    }
  }

  const handlePickReportFilter = async (next: ReportFilter) => {
    if (next === currentReportFilter || busy) return
    setSaving({ kind: 'reportFilter', value: next })
    try {
      const updated = await userApi.updateMe({
        settings: { defaultReportListFilter: next },
      })
      setUser(updated)
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      const msg = err instanceof ApiError ? err.msg : '保存失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setSaving(null)
    }
  }

  const editorName = nicknameForEditor(
    togetherRow?.lastDateEditedBy ?? null,
    user?.id,
    user?.nickname,
    partnerBrief,
  )
  const togetherHint =
    togetherRow?.lastDateEditedBy != null
      ? `由 ${editorName || '对方'} 于 ${formatAbsolute(togetherRow.updatedAt)} 修改`
      : ''

  return (
    <View
      className="min-h-screen px-5 pb-24 pt-6"
      style={{ backgroundColor: 'rgba(195,181,159,0.18)' }}
    >
      <SettingsCard
        sectionTitle="朝夕 · 在一起"
        title="一切的起点"
        hint={togetherHint}
        sectionTopClassName="mb-3"
      >
        {togetherLoadError ? (
          <Text className="mt-3 text-sm" style={{ color: '#D6A2AD' }}>
            加载失败，请稍后重试
          </Text>
        ) : !togetherRow ? (
          <Text className="mt-3 text-sm" style={{ color: '#C3B59F' }}>
            暂无「在一起」纪念日（需已绑定伴侣）
          </Text>
        ) : (
          <View className="mt-3">
            <View
              className="overflow-hidden rounded-2xl"
              style={{
                border: '1px solid rgba(195,181,159,0.5)',
                backgroundColor: 'rgba(255,255,255,0.72)',
              }}
            >
              <View className="flex flex-row items-stretch">
                <TogetherPickerColumn
                  mode="date"
                  value={togetherDraftD}
                  displayValue={togetherDraftD || '—'}
                  label="日期"
                  padL={20}
                  padR={18}
                  onPick={(v) => {
                    togetherDraftRef.current = { ...togetherDraftRef.current, d: v }
                    setTogetherDraftD(v)
                    void saveTogetherMoment(v, togetherDraftRef.current.t)
                  }}
                />
                <View
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    backgroundColor: 'rgba(195,181,159,0.45)',
                  }}
                />
                <TogetherPickerColumn
                  mode="time"
                  value={togetherDraftT}
                  displayValue={togetherDraftT}
                  label="时刻"
                  padL={18}
                  padR={20}
                  onPick={(v) => {
                    togetherDraftRef.current = { ...togetherDraftRef.current, t: v }
                    setTogetherDraftT(v)
                    void saveTogetherMoment(togetherDraftRef.current.d, v)
                  }}
                />
              </View>
            </View>
          </View>
        )}
      </SettingsCard>

      <View style={{ height: px(20) }} />

      <SettingsCard
        sectionTitle="见证 · 偏好"
        title="进入「见证」时默认显示"
        hint="点击底部「见证」进入时会默认展示该模块；在见证页内手动切换仅本次有效。"
        sectionTopClassName="mb-3"
      >
        <View
          className="mt-3 flex items-center gap-2 rounded-full p-1"
          style={{ backgroundColor: 'rgba(195,181,159,0.2)' }}
        >
          {WITNESS_DEFAULT_TAB_OPTIONS.map((opt) => {
            const active = opt.value === currentWitnessTab
            const isSaving = saving?.kind === 'witnessTab' && saving.value === opt.value
            return (
              <View
                key={opt.value}
                className="flex-1 rounded-full py-2 text-center"
                style={{ backgroundColor: active ? '#668F80' : 'transparent' }}
                onClick={() => void handlePickWitnessTab(opt.value)}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: active ? '#fff' : '#4A6670' }}
                >
                  {isSaving ? '保存中…' : opt.label}
                </Text>
              </View>
            )
          })}
        </View>
      </SettingsCard>

      <View style={{ height: px(20) }} />

      <SettingsCard
        sectionTitle="见证 · 报备 · 筛选"
        title="进入「见证」的「报备」时默认展示"
        hint="打开报备列表时会默认落在此筛选；在见证页内切换筛选仅本次有效。"
        sectionTopClassName="mb-3"
      >
        <View
          className="mt-3 flex items-center gap-1.5 rounded-full p-1"
          style={{ backgroundColor: 'rgba(195,181,159,0.2)' }}
        >
          {REPORT_LIST_FILTER_OPTIONS.map((opt) => {
            const active = opt.value === currentReportFilter
            const isSaving = saving?.kind === 'reportFilter' && saving.value === opt.value
            return (
              <View
                key={opt.value}
                className="min-w-0 flex-1 rounded-full py-2 px-0.5 text-center"
                style={{ backgroundColor: active ? '#668F80' : 'transparent' }}
                onClick={() => void handlePickReportFilter(opt.value)}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: active ? '#fff' : '#4A6670' }}
                  numberOfLines={1}
                >
                  {isSaving ? '保存中' : opt.label}
                </Text>
              </View>
            )
          })}
        </View>
      </SettingsCard>
    </View>
  )
}
