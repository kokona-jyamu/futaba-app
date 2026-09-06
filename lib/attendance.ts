/* lib/attendance.ts — 出欠連絡の共通定義 */

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

/** 'YYYY-MM-DD'（日本時間） */
export const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-` +
  `${String(d.getMonth() + 1).padStart(2, '0')}-` +
  `${String(d.getDate()).padStart(2, '0')}`

export const todayStr = () => toDateStr(new Date())

/** 開始日から終了日までの日付を並べる（最大62日） */
export const dateRange = (from: string, to: string): string[] => {
  const list: string[] = []
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return list
  if (end < start) return list

  const cur = new Date(start)
  while (cur <= end && list.length < 62) {
    list.push(toDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return list
}

const WD = ['日', '月', '火', '水', '木', '金', '土']

export const weekdayOf = (dateStr: string) =>
  WD[new Date(`${dateStr}T00:00:00`).getDay()]

export const isWeekend = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`).getDay()
  return d === 0 || d === 6
}

/** 「7月27日(月)」 */
export const formatShort = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`
}

/** 締め切りを過ぎているか。当日以外は常に受け付ける */
export const isPastDeadline = (
  targetDate: string,
  deadline = '09:00',
  now = new Date()
): boolean => {
  if (targetDate !== toDateStr(now)) return false
  const [h, m] = deadline.split(':').map(Number)
  const limit = new Date(now)
  limit.setHours(h ?? 9, m ?? 0, 0, 0)
  return now > limit
}

/** 体温が発熱かどうか（37.5度以上を目安とする） */
export const hasFever = (t?: number | null) => typeof t === 'number' && t >= 37.5