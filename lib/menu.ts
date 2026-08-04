/* lib/menu.ts — 献立まわりの共通定義（管理画面・保護者画面の両方から使う） */

export const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

export const ALLERGENS = [
  { key: 'egg', label: '卵', emoji: '🥚' },
  { key: 'milk', label: '乳', emoji: '🥛' },
  { key: 'wheat', label: '小麦', emoji: '🌾' },
  { key: 'buckwheat', label: 'そば', emoji: '🍜' },
  { key: 'peanut', label: '落花生', emoji: '🥜' },
  { key: 'shrimp', label: 'えび', emoji: '🦐' },
  { key: 'crab', label: 'かに', emoji: '🦀' },
  { key: 'walnut', label: 'くるみ', emoji: '🌰' },
  { key: 'cashew', label: 'カシュー', emoji: '🌱' },
] as const

export const NUTRIENTS = [
  { name: 'kcal', label: 'エネルギー', unit: 'kcal' },
  { name: 'carb', label: '炭水化物', unit: 'g' },
  { name: 'protein', label: 'タンパク質', unit: 'g' },
  { name: 'fat', label: '脂質', unit: 'g' },
  { name: 'salt', label: '食塩相当量', unit: 'g' },
  { name: 'calcium', label: 'カルシウム', unit: 'mg' },
] as const

export type Allergens = Record<string, boolean>

export const emptyAllergens = (): Allergens =>
  ALLERGENS.reduce((acc, a) => ({ ...acc, [a.key]: false }), {} as Allergens)

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