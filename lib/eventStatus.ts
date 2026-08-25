/* lib/eventStatus.ts — 食育イベントの状態を日付から判定する
 *
 * status 列は使わない。
 * 栄養士が切り替え忘れて「予告のまま残る」事故を防ぐため、
 * 日付だけで機械的に決める。
 */

export type EventPhase = 'upcoming' | 'today' | 'past'

/** 今日の日付を 'YYYY-MM-DD' で返す（日本時間） */
export const todayStr = (): string => {
  const d = new Date()
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  )
}

/** イベントが予告・本日・記録のどれかを返す */
export const phaseOf = (eventDate?: string | null): EventPhase => {
  if (!eventDate) return 'past'
  const today = todayStr()
  if (eventDate > today) return 'upcoming'
  if (eventDate === today) return 'today'
  return 'past'
}

export const isUpcoming = (e: { event_date?: string | null }) =>
  phaseOf(e.event_date) === 'upcoming'

export const isToday = (e: { event_date?: string | null }) =>
  phaseOf(e.event_date) === 'today'

export const isPast = (e: { event_date?: string | null }) =>
  phaseOf(e.event_date) === 'past'

/** 予告と本日ぶん（＝これから、または今日） */
export const isAhead = (e: { event_date?: string | null }) =>
  phaseOf(e.event_date) !== 'past'

/** 表示用のラベル */
export const phaseLabel = (phase: EventPhase): string =>
  phase === 'upcoming' ? '予告' : phase === 'today' ? '本日開催' : '記録'