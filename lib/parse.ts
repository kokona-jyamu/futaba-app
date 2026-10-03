/* lib/parse.ts — API が受け取った値を、DB の列の型に合わせて変換する
 *
 * 画面から届く JSON は何が入っているか分からないため、
 * DB に入れる前に必ずここを通す。変換できない値は null にする。
 */

/** 受け取った JSON の本体（中身はまだ確かめていない） */
export type Body = Record<string, unknown>

/** 文字列。空文字や文字列以外は null */
export const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null

/** 数値。空や数値にならないものは null（numeric 列用） */
export const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 文字列の配列。空の配列や配列以外は null */
export const strList = (v: unknown): string[] | null => {
  if (!Array.isArray(v)) return null
  const list = v.map((s) => String(s).trim()).filter(Boolean)
  return list.length > 0 ? list : null
}
