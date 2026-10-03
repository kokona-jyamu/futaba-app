/* lib/attendance.ts — 出欠連絡の共通定義 */

import {
  todayStr, addDays, weekdayIndex, parseYmd, nowJST, isDateStr,
} from '@/lib/date'

export type AttendanceStatus = 'present' | 'late' | 'absent'

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '出席',
  late: '遅刻',
  absent: '欠席',
}

/** 欠席・遅刻の理由 */
export const REASON_TYPES = [
  { key: 'sick',     label: '病欠' },
  { key: 'family',   label: '家庭の都合' },
  { key: 'hospital', label: '通院' },
  { key: 'other',    label: 'その他' },
] as const

export const reasonLabel = (key?: string | null) =>
  REASON_TYPES.find((r) => r.key === key)?.label ?? ''

export type Attendance = {
  id: string
  child_id: string
  target_date: string
  status: AttendanceStatus
  arrival_time: string | null
  needs_lunch: boolean
  reason_type: string | null
  reason: string | null
  temperature: number | null
  symptoms: string | null
  created_at: string
  updated_at: string
}

/* 今日の日付は lib/date に一本化した。既存の import 先を変えずに済むよう再公開する */
export { todayStr }

/** 開始日から終了日までの日付を並べる（最大62日） */
export const dateRange = (from: string, to: string): string[] => {
  const list: string[] = []
  if (!isDateStr(from) || !isDateStr(to) || to < from) return list

  let cur = from
  while (cur <= to && list.length < 62) {
    list.push(cur)
    cur = addDays(cur, 1)
  }
  return list
}

const WD = ['日', '月', '火', '水', '木', '金', '土']

export const weekdayOf = (dateStr: string) => WD[weekdayIndex(dateStr)]

export const isWeekend = (dateStr: string) => {
  const d = weekdayIndex(dateStr)
  return d === 0 || d === 6
}

/** 「7月27日(月)」 */
export const formatShort = (dateStr: string) => {
  const { month, day } = parseYmd(dateStr)
  return `${month}月${day}日(${weekdayOf(dateStr)})`
}

/** 締め切りを過ぎているか（日本時間で判定）。当日以外は常に受け付ける */
export const isPastDeadline = (
  targetDate: string,
  deadline = '09:00',
  now = new Date()
): boolean => {
  if (targetDate !== todayStr(now)) return false
  const [h, m] = deadline.split(':').map(Number)
  const { hour, minute } = nowJST(now)
  const limit = (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0)
  return hour * 60 + minute >= limit
}

/** 体温が発熱かどうか（37.5度以上を目安とする） */
export const hasFever = (t?: number | null) => typeof t === 'number' && t >= 37.5