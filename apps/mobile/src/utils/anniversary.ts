/**
 * 纪念日的派生指标（全部公历年年循环）：
 *   - totalDays：从 date 那一天到今天的总天数（正数）。适合"在一起"「累计 N 天」。
 *   - daysToNext：距离下一次同月同日还剩几天。今天就是那天时返回 0。
 *   - turn：下一次是第几周年（date 的年份若已在今年之前，且今年还没过则为今年 − date.year；已过则 +1）。
 *
 * 所有计算都落到 UTC 零点，避免时区抖动造成 ±1 天偏差。
 */
const MS_DAY = 24 * 60 * 60 * 1000
const MS_HOUR = 60 * 60 * 1000
const MS_MINUTE = 60 * 1000

function toUtcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export interface AnniversaryStats {
  totalDays: number
  daysToNext: number
  /** 下一次是第几周年；原日之后第一次到来记 1。 */
  turn: number
  /** 下一次循环的月份（1-12） */
  nextMonth: number
  /** 下一次循环的日（1-31） */
  nextDay: number
}

export function computeAnniversaryStats(dateIso: string): AnniversaryStats {
  const now = new Date()
  const todayUtc = toUtcMidnight(now)
  const orig = new Date(dateIso)
  const origUtc = toUtcMidnight(orig)

  const totalDays = Math.max(0, Math.floor((todayUtc - origUtc) / MS_DAY))

  const month = orig.getUTCMonth()
  const day = orig.getUTCDate()
  const thisYear = now.getUTCFullYear()
  let nextUtc = Date.UTC(thisYear, month, day)
  if (nextUtc < todayUtc) {
    nextUtc = Date.UTC(thisYear + 1, month, day)
  }
  const daysToNext = Math.max(0, Math.round((nextUtc - todayUtc) / MS_DAY))

  const nextYear = new Date(nextUtc).getUTCFullYear()
  const turn = Math.max(1, nextYear - orig.getUTCFullYear())

  return {
    totalDays,
    daysToNext,
    turn,
    nextMonth: month + 1,
    nextDay: day,
  }
}

/** "5 月 20 日" 风格的短日期展示。 */
export function formatMonthDay(dateIso: string): string {
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`
}

/** ISO（UTC）→ `YYYY-MM-DD`，供 Taro `Picker mode="date"`。 */
export function isoToPickerValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Picker 返回值 → 后端 ISO UTC 零点。 */
export function pickerValueToIso(val: string): string {
  return `${val}T00:00:00.000Z`
}

/**
 * 「在一起」从某一时刻起的累计天与当日内时分秒（与日历日无关，按真实时间间隔）。
 */
export function computeTogetherElapsed(
  dateIso: string,
  now: Date = new Date(),
): { totalDays: number; hours: number; minutes: number; seconds: number } {
  const t0 = new Date(dateIso).getTime()
  const t1 = now.getTime()
  if (Number.isNaN(t0) || t1 < t0) {
    return { totalDays: 0, hours: 0, minutes: 0, seconds: 0 }
  }
  let ms = t1 - t0
  const totalDays = Math.floor(ms / MS_DAY)
  ms -= totalDays * MS_DAY
  const hours = Math.floor(ms / MS_HOUR)
  ms -= hours * MS_HOUR
  const minutes = Math.floor(ms / MS_MINUTE)
  ms -= minutes * MS_MINUTE
  const seconds = Math.floor(ms / 1000)
  return { totalDays, hours, minutes, seconds }
}

/**
 * ISO（任意 UTC）→ `YYYY-MM-DD HH:mm` **本地墙钟**，供设置页日期 + 时刻两个 Picker 组合使用。
 */
export function isoToDatetimeLocalPickerValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

/** `YYYY-MM-DD HH:mm` 本地 → UTC ISO（秒为 0）；无法解析时返回 `null`。 */
export function datetimeLocalPickerValueToUtcIso(val: string): string | null {
  const m = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  const out = new Date(y, mo - 1, d, h, mi, 0, 0)
  if (Number.isNaN(out.getTime())) return null
  return out.toISOString()
}
