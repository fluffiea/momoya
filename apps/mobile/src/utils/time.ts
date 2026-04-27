/**
 * 时间展示帮手。
 * - `formatRelative(iso)`：刚刚 / N 分钟前 / N 小时前 / 昨天 HH:mm / MM-DD HH:mm / YYYY-MM-DD
 * - `formatAbsolute(iso)`：MM-DD HH:mm（跨年则带年份），用于卡片右侧精确时间戳
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''

  const diffMs = now.getTime() - t.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMs / 3_600_000)

  if (diffMs < 60_000) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24 && sameDay(t, now)) return `${diffHour} 小时前`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(t, yesterday)) {
    return `昨天 ${pad2(t.getHours())}:${pad2(t.getMinutes())}`
  }

  if (t.getFullYear() === now.getFullYear()) {
    return `${pad2(t.getMonth() + 1)}-${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`
  }
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`
}

export function formatAbsolute(iso: string, now: Date = new Date()): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  const base = `${pad2(t.getMonth() + 1)}-${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`
  if (t.getFullYear() === now.getFullYear()) return base
  return `${t.getFullYear()}-${base}`
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
