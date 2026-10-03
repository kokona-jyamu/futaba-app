/* lib/questionLimit.ts — 質問の回数制限
 *
 * 各家庭「月曜起算の週」につき2回まで。
 * 判定はサーバー側でも行うため、ここには共用のロジックだけを置く。
 */

import { todayStr, addDays, weekdayIndex, parseYmd } from '@/lib/date'

export const WEEKLY_LIMIT = 2

/** 園の連絡先（緊急時の案内に使う） */
export const SCHOOL_TEL = '0000-00-0000'

/** その日が属する週の月曜日を 'YYYY-MM-DD' で返す（日本時間） */
export function weekStartOf(date: Date = new Date()): string {
  const today = todayStr(date)
  const day = weekdayIndex(today)        // 0=日曜
  const diff = day === 0 ? -6 : 1 - day  // 月曜まで戻す
  return addDays(today, diff)
}

/** 次に使えるようになる日（＝翌週の月曜）を「7月27日」の形で返す */
export function nextMondayLabel(date: Date = new Date()): string {
  const { month, day } = parseYmd(addDays(weekStartOf(date), 7))
  return `${month}月${day}日`
}

/** 残り回数から案内文を作る */
export function limitMessage(remaining: number): string {
  if (remaining > 0) {
    return `今週はあと${remaining}回おたずねできます。`
  }
  return `今週はあと0回です。${nextMondayLabel()}（月曜）からまたお使いいただけます。`
}