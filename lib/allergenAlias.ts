/* lib/allergenAlias.ts — アレルゲン名称の表記ゆれを吸収する
 *
 * Excel から貼り付けた文字列を、28品目のキーに変換する。
 * ひらがな・漢字・略称など、実際に書かれそうな表記を拾う。
 */

import { STANDARD_ALLERGENS } from '@/lib/allergens'

/** キーごとの別名。ここにない語は「未知」として扱う */
const ALIASES: Record<string, string[]> = {
  egg: ['卵', 'たまご', 'タマゴ', '玉子', '鶏卵', '卵類'],
  milk: ['乳', '乳製品', '牛乳', 'ミルク', '乳成分', 'チーズ', 'バター'],
  wheat: ['小麦', 'こむぎ', 'コムギ', '麦', '小麦粉'],
  buckwheat: ['そば', 'ソバ', '蕎麦'],
  peanut: ['落花生', 'らっかせい', 'ピーナッツ', 'ピーナツ'],
  shrimp: ['えび', 'エビ', '海老', '蝦'],
  crab: ['かに', 'カニ', '蟹'],
  walnut: ['くるみ', 'クルミ', '胡桃'],
  almond: ['アーモンド', 'あーもんど'],
  abalone: ['あわび', 'アワビ', '鮑'],
  squid: ['いか', 'イカ', '烏賊'],
  salmonroe: ['いくら', 'イクラ', '筋子', 'すじこ'],
  orange: ['オレンジ', 'おれんじ'],
  cashew: ['カシューナッツ', 'カシュー', 'かしゅーなっつ'],
  kiwi: ['キウイ', 'キウイフルーツ', 'きうい'],
  beef: ['牛肉', 'ぎゅうにく', '牛'],
  sesame: ['ごま', 'ゴマ', '胡麻', 'ごま油'],
  salmon: ['さけ', 'サケ', '鮭', 'サーモン', 'しゃけ'],
  mackerel: ['さば', 'サバ', '鯖'],
  soy: ['大豆', 'だいず', 'ダイズ', '豆腐', 'みそ', '味噌', 'しょうゆ', '醤油'],
  chicken: ['鶏肉', 'とりにく', '鶏', 'とり肉'],
  banana: ['バナナ', 'ばなな'],
  pork: ['豚肉', 'ぶたにく', '豚', 'ぶた肉'],
  matsutake: ['まつたけ', 'マツタケ', '松茸'],
  peach: ['もも', 'モモ', '桃', 'ピーチ'],
  yam: ['やまいも', 'ヤマイモ', '山芋', 'ながいも', '長芋'],
  apple: ['りんご', 'リンゴ', '林檎', 'アップル'],
  gelatin: ['ゼラチン', 'ぜらちん'],
}

/** 「該当なし」を表す語 */
const NONE_WORDS = ['なし', 'ナシ', '無', '無し', 'none', '-', '―', '－', '該当なし']

/** 検索用の逆引き表を作る */
const lookup = (() => {
  const map = new Map<string, string>()
  STANDARD_ALLERGENS.forEach((a) => {
    map.set(a.label, a.key)
    map.set(a.key, a.key)
  })
  Object.entries(ALIASES).forEach(([key, names]) => {
    names.forEach((n) => map.set(n, key))
  })
  return map
})()

const normalize = (s: string) =>
  s.trim().replace(/[（(].*?[）)]/g, '').replace(/\s+/g, '')

export type ParsedAllergens =
  | { status: 'none'; allergens: Record<string, boolean>; unknown: [] }
  | { status: 'listed'; allergens: Record<string, boolean>; unknown: string[] }
  | { status: 'empty'; allergens: null; unknown: [] }

/**
 * 「卵・乳・小麦」のような文字列を解析する。
 *
 *  - 空文字         → status: 'empty'（登録させない）
 *  - 「なし」など   → status: 'none'（該当なしとして確認済み）
 *  - それ以外       → status: 'listed'（変換できなかった語は unknown に入る）
 */
export function parseAllergenText(text: string): ParsedAllergens {
  const raw = (text ?? '').trim()

  if (!raw) return { status: 'empty', allergens: null, unknown: [] }

  const normalized = normalize(raw)
  if (NONE_WORDS.some((w) => normalized === w)) {
    return { status: 'none', allergens: {}, unknown: [] }
  }

  const parts = raw
    .split(/[・,、\/／|｜\s]+/)
    .map(normalize)
    .filter(Boolean)

  const allergens: Record<string, boolean> = {}
  const unknown: string[] = []

  parts.forEach((p) => {
    const key = lookup.get(p)
    if (key) allergens[key] = true
    else unknown.push(p)
  })

  /* 「なし」だけが並んでいた場合も該当なし扱いにする */
  if (Object.keys(allergens).length === 0 && unknown.length === 0) {
    return { status: 'none', allergens: {}, unknown: [] }
  }

  return { status: 'listed', allergens, unknown }
}

/** 日付を 'YYYY-MM-DD' に揃える。'9/1' '9月1日' '2026-09-01' などを受ける */
export function parseDate(text: string, fallbackYear?: number): string | null {
  const s = (text ?? '').trim()
  if (!s) return null

  const year = fallbackYear ?? new Date().getFullYear()

  /* 2026-09-01 / 2026/9/1 */
  let m = s.match(/^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`

  /* 9/1 / 9月1日 */
  m = s.match(/^(\d{1,2})[-/月.](\d{1,2})/)
  if (m) return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`

  /* Excel のシリアル値（1900年起算） */
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000)
    return d.toISOString().slice(0, 10)
  }

  return null
}