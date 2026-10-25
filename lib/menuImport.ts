/* lib/menuImport.ts — 月間献立の貼り付け（Excel など）を読み取る（画面で使う）
 *
 * 給食管理ソフト（わんぱくランチ など）から書き出した Excel をそのまま貼れるようにする。
 *  - タブ区切り（Excel のコピー）を読む。セルの中の改行（Alt+Enter）も正しく扱う
 *  - 列の意味（日付・献立名・主食…）は、列ごとに選べる。1行目が見出しなら自動で読む
 *  - 日付が空欄の行は、すぐ上の日の続き（1品1行の帳票に対応）
 *  - 料理のセルの中の改行は、1品ずつの区切り
 *  - 献立名が空欄の日は、料理名から作る
 */

import { parseAllergenText, parseDate } from '@/lib/allergenAlias'
import type { PhotoKind } from '@/lib/menuPhotos'

/* ----------------------------------------------------------------
   列の意味
   ---------------------------------------------------------------- */

/** 料理以外の列の意味 */
export const BASE_FIELDS = [
  { key: 'date', label: '日付' },
  { key: 'title', label: '献立名' },
  { key: 'ingredients', label: '主な食材' },
  { key: 'kcal', label: 'エネルギー' },
  { key: 'protein', label: 'たんぱく質' },
  { key: 'fat', label: '脂質' },
  { key: 'carb', label: '炭水化物' },
  { key: 'salt', label: '食塩' },
  { key: 'calcium', label: 'カルシウム' },
  { key: 'allergens', label: 'アレルゲン' },
] as const

export type BaseField = (typeof BASE_FIELDS)[number]['key']

/** 列の意味。料理の列は「kind:種類のID」、使わない列は 'ignore' */
export type ColumnField = BaseField | `kind:${string}` | 'ignore'

/** 見出しの文字から列の意味を当てるための言い換え */
const HEADER_ALIASES: Record<BaseField, string[]> = {
  date: ['日付', '日', '月日', '年月日', '提供日'],
  title: ['献立名', '献立', 'メニュー', '料理名'],
  ingredients: ['主な食材', '食材', '材料', '使用食材'],
  kcal: ['エネルギー', 'エネルギー(kcal)', 'kcal', '熱量'],
  protein: ['たんぱく質', 'タンパク質', '蛋白質', 'たんぱく質(g)'],
  fat: ['脂質', '脂質(g)', '脂肪'],
  carb: ['炭水化物', '炭水化物(g)', '糖質'],
  salt: ['食塩', '食塩相当量', '塩分', '食塩(g)'],
  calcium: ['カルシウム', 'カルシウム(mg)', 'ca'],
  allergens: ['アレルゲン', 'アレルギー', '特定原材料', 'アレルギー表示'],
}

const normalizeHeader = (s: string) => s.replace(/\s+/g, '').replace(/[（(].*?[）)]/g, '').toLowerCase()

/** 見出しの1セルから、列の意味を当てる。わからなければ null */
function guessField(header: string, kinds: PhotoKind[]): ColumnField | null {
  const h = normalizeHeader(header)
  if (!h) return null
  for (const k of kinds) {
    if (normalizeHeader(k.label) === h) return `kind:${k.id}`
  }
  for (const f of BASE_FIELDS) {
    if (HEADER_ALIASES[f.key].some((a) => normalizeHeader(a) === h)) return f.key
  }
  return null
}

/**
 * 1行目が見出しかどうかを判定し、見出しなら列の意味を返す。
 * 「日付」と、ほかに1つ以上の列の意味がわかったときだけ見出しとみなす。
 */
export function detectHeader(firstRow: string[], kinds: PhotoKind[]): ColumnField[] | null {
  const guessed = firstRow.map((c) => guessField(c, kinds))
  const known = guessed.filter((g): g is ColumnField => g !== null)
  if (!known.includes('date') || known.length < 2) return null
  return guessed.map((g) => g ?? 'ignore')
}

/** 見出しがないときの列の並び（これまでの10列＋料理の種類の順） */
export function defaultColumns(count: number, kinds: PhotoKind[]): ColumnField[] {
  const order: ColumnField[] = [
    ...BASE_FIELDS.map((f) => f.key),
    ...kinds.filter((k) => k.is_active).map((k) => `kind:${k.id}` as const),
  ]
  return Array.from({ length: count }, (_, i) => order[i] ?? 'ignore')
}

/* ----------------------------------------------------------------
   表の読み取り（Excel のコピー＝タブ区切り。セルの中の改行は "…" で囲まれる）
   ---------------------------------------------------------------- */

export function parseTable(text: string): string[][] {
  const delimiter = text.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
      continue
    }
    if (c === '"' && cell === '') quoted = true
    else if (c === delimiter) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }

  /* 空の行は捨てる */
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/* ----------------------------------------------------------------
   1日ずつにまとめる
   ---------------------------------------------------------------- */

export type ParsedDish = { kind_id: string; name: string }

export type ParsedDay = {
  /** 何行目から読んだか（エラーの案内用。1から数える） */
  lineNo: number
  served_date: string | null
  title: string
  ingredients: string[] | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carb: number | null
  salt: number | null
  calcium: number | null
  allergens: Record<string, boolean> | null
  allergenStatus: 'none' | 'listed' | 'empty'
  unknownAllergens: string[]
  dishes: ParsedDish[]
  error: string | null
}

const toNum = (s?: string) => {
  const v = Number.parseFloat((s ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(v) ? v : null
}

/** セルの中を改行で分ける（料理・食材の区切り） */
const splitLines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

/**
 * 表を1日ずつにまとめる。
 * dataRows は見出しを除いた行、columns は列ごとの意味。
 */
export function groupDays(dataRows: string[][], columns: ColumnField[], firstLineNo: number): ParsedDay[] {
  const days: { lineNo: number; cells: Record<string, string[]>; dishes: ParsedDish[] }[] = []

  dataRows.forEach((row, i) => {
    const cellOf = (field: ColumnField) =>
      columns.flatMap((f, col) => (f === field && row[col]?.trim() ? [row[col].trim()] : []))

    const hasDate = cellOf('date').length > 0
    /* 日付が空欄の行は、すぐ上の日の続き */
    if (!hasDate && days.length > 0) {
      const day = days[days.length - 1]
      for (const f of columns) {
        if (f === 'ignore' || f.startsWith('kind:')) continue
        day.cells[f] = [...(day.cells[f] ?? []), ...cellOf(f)]
      }
      day.dishes.push(...dishesOf(row, columns))
      return
    }

    const cells: Record<string, string[]> = {}
    for (const f of new Set(columns)) {
      if (f !== 'ignore' && !f.startsWith('kind:')) cells[f] = cellOf(f)
    }
    days.push({ lineNo: firstLineNo + i, cells, dishes: dishesOf(row, columns) })
  })

  return days.map(({ lineNo, cells, dishes }) => {
    const first = (k: BaseField) => cells[k]?.[0] ?? ''
    const served_date = parseDate(first('date'))

    /* アレルゲンは、その日の行のぶんをまとめて読む */
    const allergenText = (cells.allergens ?? []).join('・')
    const parsed = parseAllergenText(allergenText)

    const uniqueDishes = dishes.filter(
      (d, i) => dishes.findIndex((x) => x.kind_id === d.kind_id && x.name === d.name) === i
    )
    /* 献立名が空欄なら、料理名から作る */
    const title = first('title') || uniqueDishes.map((d) => d.name).join('・')

    const ingredientCells = (cells.ingredients ?? []).flatMap(splitLines)
    const ingredients = ingredientCells
      .flatMap((s) => s.split(/[・,、/]+/))
      .map((s) => s.trim())
      .filter(Boolean)

    let error: string | null = null
    if (!served_date) error = '日付が読み取れません'
    else if (!title) error = '献立名も料理名もありません'
    else if (parsed.status === 'empty') error = 'アレルゲンが未記入です'

    return {
      lineNo,
      served_date,
      title,
      ingredients: ingredients.length > 0 ? ingredients : null,
      kcal: toNum(first('kcal')),
      protein: toNum(first('protein')),
      fat: toNum(first('fat')),
      carb: toNum(first('carb')),
      salt: toNum(first('salt')),
      calcium: toNum(first('calcium')),
      allergens: parsed.allergens,
      allergenStatus: parsed.status,
      unknownAllergens: parsed.unknown,
      dishes: uniqueDishes,
      error,
    }
  })
}

/** 1行の中の料理（料理の列。セルの中の改行は1品ずつ） */
function dishesOf(row: string[], columns: ColumnField[]): ParsedDish[] {
  return columns.flatMap((f, col) =>
    f.startsWith('kind:')
      ? splitLines(row[col] ?? '').map((name) => ({ kind_id: f.slice(5), name: name.slice(0, 60) }))
      : []
  )
}
