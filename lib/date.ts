/* lib/date.ts — 日付の共通処理（すべて日本時間で扱う。クライアント・サーバー共用）
 *
 * サーバーは UTC で動くことがあるため、new Date() の getDate() などを
 * そのまま使うと、日本時間の 0〜9 時に「今日」が前日になる。
 * 「今」を扱うときは必ずここを通す。
 *
 * 'YYYY-MM-DD' どうしの計算は Date.UTC で行い、
 * 端末やサーバーの時差に左右されないようにしている。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

/** 日本時間で見た「今」の年・月（1〜12）・日・時・分 */
export function nowJST(now: Date = new Date()) {
  const j = new Date(now.getTime() + JST_OFFSET_MS)
  return {
    year: j.getUTCFullYear(),
    month: j.getUTCMonth() + 1,
    day: j.getUTCDate(),
    hour: j.getUTCHours(),
    minute: j.getUTCMinutes(),
  }
}

/** 年・月（1〜12）・日から 'YYYY-MM-DD' を作る。範囲外の月日は前後の月に繰り越す */
export function ymd(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 'YYYY-MM-DD' を年・月（1〜12）・日に分ける */
export function parseYmd(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

/** 今日の日付（日本時間）を 'YYYY-MM-DD' で返す */
export function todayStr(now: Date = new Date()): string {
  const { year, month, day } = nowJST(now)
  return ymd(year, month, day)
}

/** n 日後（負なら n 日前）の日付 */
export function addDays(dateStr: string, n: number): string {
  const { year, month, day } = parseYmd(dateStr)
  return ymd(year, month, day + n)
}

/** 曜日を返す（0=日曜） */
export function weekdayIndex(dateStr: string): number {
  const { year, month, day } = parseYmd(dateStr)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** その日から n か月後の月の1日 */
export function monthStart(dateStr: string, n = 0): string {
  const { year, month } = parseYmd(dateStr)
  return ymd(year, month + n, 1)
}

/** その日から n か月後の月の末日 */
export function monthEnd(dateStr: string, n = 0): string {
  const { year, month } = parseYmd(dateStr)
  return ymd(year, month + n + 1, 0)
}

/** 'YYYY-MM-DD' の形になっているか */
export const isDateStr = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
