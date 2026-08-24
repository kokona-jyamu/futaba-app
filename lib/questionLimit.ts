/* lib/questionLimit.ts — 質問の回数制限
 *
 * 各家庭「月曜起算の週」につき2回まで。
 * 判定はサーバー側でも行うため、ここには共用のロジックだけを置く。
 */

export const WEEKLY_LIMIT = 2

/** 園の連絡先（緊急時の案内に使う） */
export const SCHOOL_TEL = '0000-00-0000'

/** その日が属する週の月曜日を 'YYYY-MM-DD' で返す（日本時間） */
export function weekStartOf(date: Date = new Date()): string {
  /* 日本時間に寄せてから曜日を判定する */
  const jst = new Date(date.getTime() + (9 * 60 + date.getTimezoneOffset()) * 60000)
  const day = jst.getDay()               // 0=日曜
  const diff = day === 0 ? -6 : 1 - day  // 月曜まで戻す
  jst.setDate(jst.getDate() + diff)
  return (
    `${jst.getFullYear()}-` +
    `${String(jst.getMonth() + 1).padStart(2, '0')}-` +
    `${String(jst.getDate()).padStart(2, '0')}`
  )
}

/** 次に使えるようになる日（＝翌週の月曜）を「7月27日」の形で返す */
export function nextMondayLabel(date: Date = new Date()): string {
  const monday = new Date(`${weekStartOf(date)}T00:00:00`)
  monday.setDate(monday.getDate() + 7)
  return monday.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
}

/** 残り回数から案内文を作る */
export function limitMessage(remaining: number): string {
  if (remaining > 0) {
    return `今週はあと${remaining}回おたずねできます。`
  }
  return `今週はあと0回です。${nextMondayLabel()}（月曜）からまたお使いいただけます。`
}