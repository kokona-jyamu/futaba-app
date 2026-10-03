/* lib/menu.ts — 献立まわりの共通定義（管理画面・保護者画面の両方から使う） */

export const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

/* アレルゲンの定義は lib/allergens.ts に一本化している（標準28品目） */

export const NUTRIENTS = [
  { name: 'kcal', label: 'エネルギー', unit: 'kcal' },
  { name: 'carb', label: '炭水化物', unit: 'g' },
  { name: 'protein', label: 'タンパク質', unit: 'g' },
  { name: 'fat', label: '脂質', unit: 'g' },
  { name: 'salt', label: '食塩相当量', unit: 'g' },
  { name: 'calcium', label: 'カルシウム', unit: 'mg' },
] as const

/** 空文字を null に落として数値化する（Supabase の numeric 列用） */
export const num = (v: unknown) =>
  v === '' || v === null || v === undefined ? null : Number.parseFloat(String(v))

/** 'YYYY-MM-DD' を「7月27日(月)」に。T00:00:00 を付けて UTC ずれを防ぐ */
export const formatDate = (d?: string) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
    : ''

/** テキスト入力を配列にする（改行・カンマ・読点で区切る） */
export const parseIngredients = (text: string): string[] | null => {
  const list = text
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length > 0 ? list : null
}

/** 配列を入力欄に戻す（読点区切り） */
export const formatIngredients = (list?: string[] | null): string =>
  Array.isArray(list) ? list.join('、') : ''