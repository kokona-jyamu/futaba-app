/* lib/allergens.ts — アレルゲンのマスタ定義
 *
 * 消費者庁の表示対象品目にもとづく。
 *  - required : 表示義務8品目（えび・かに・くるみ・小麦・そば・卵・乳・落花生）
 *  - optional : 表示推奨20品目
 *
 * 園が独自に追加したものは school_allergens テーブルから読み、
 * これらの後ろに並べる。
 */

export type AllergenDef = {
  key: string
  label: string
  emoji: string
  /** 表示義務品目かどうか */
  required: boolean
}

/** 表示義務8品目：投稿画面でも常に表示する */
export const REQUIRED_ALLERGENS: AllergenDef[] = [
  { key: 'egg',       label: '卵',     emoji: '🥚', required: true },
  { key: 'milk',      label: '乳',     emoji: '🥛', required: true },
  { key: 'wheat',     label: '小麦',   emoji: '🌾', required: true },
  { key: 'buckwheat', label: 'そば',   emoji: '🍜', required: true },
  { key: 'peanut',    label: '落花生', emoji: '🥜', required: true },
  { key: 'shrimp',    label: 'えび',   emoji: '🦐', required: true },
  { key: 'crab',      label: 'かに',   emoji: '🦀', required: true },
  { key: 'walnut',    label: 'くるみ', emoji: '🌰', required: true },
]

/** 表示推奨20品目：「もっと見る」で展開する */
export const OPTIONAL_ALLERGENS: AllergenDef[] = [
  { key: 'almond',    label: 'アーモンド', emoji: '🌰', required: false },
  { key: 'abalone',   label: 'あわび',     emoji: '🐚', required: false },
  { key: 'squid',     label: 'いか',       emoji: '🦑', required: false },
  { key: 'salmonroe', label: 'いくら',     emoji: '🍣', required: false },
  { key: 'orange',    label: 'オレンジ',   emoji: '🍊', required: false },
  { key: 'cashew',    label: 'カシューナッツ', emoji: '🌱', required: false },
  { key: 'kiwi',      label: 'キウイ',     emoji: '🥝', required: false },
  { key: 'beef',      label: '牛肉',       emoji: '🥩', required: false },
  { key: 'sesame',    label: 'ごま',       emoji: '🫘', required: false },
  { key: 'salmon',    label: 'さけ',       emoji: '🐟', required: false },
  { key: 'mackerel',  label: 'さば',       emoji: '🐟', required: false },
  { key: 'soy',       label: '大豆',       emoji: '🫛', required: false },
  { key: 'chicken',   label: '鶏肉',       emoji: '🍗', required: false },
  { key: 'banana',    label: 'バナナ',     emoji: '🍌', required: false },
  { key: 'pork',      label: '豚肉',       emoji: '🐖', required: false },
  { key: 'matsutake', label: 'まつたけ',   emoji: '🍄', required: false },
  { key: 'peach',     label: 'もも',       emoji: '🍑', required: false },
  { key: 'yam',       label: 'やまいも',   emoji: '🍠', required: false },
  { key: 'apple',     label: 'りんご',     emoji: '🍎', required: false },
  { key: 'gelatin',   label: 'ゼラチン',   emoji: '🍮', required: false },
]

/** 標準28品目 */
export const STANDARD_ALLERGENS: AllergenDef[] = [
  ...REQUIRED_ALLERGENS,
  ...OPTIONAL_ALLERGENS,
]

/** 園が独自に追加したもの（DBから読む） */
export type CustomAllergen = {
  id: string
  key: string
  label: string
  emoji: string | null
  sort_order: number
}

/** 標準＋独自をひとつの配列にする */
export const mergeAllergens = (custom: CustomAllergen[] = []): AllergenDef[] => [
  ...STANDARD_ALLERGENS,
  ...custom.map((c) => ({
    key: c.key,
    label: c.label,
    emoji: c.emoji ?? '🍽️',
    required: false,
  })),
]

/** key から定義を引く。未知の key でも落ちないようにする */
export const findAllergen = (
  key: string,
  custom: CustomAllergen[] = []
): AllergenDef =>
  mergeAllergens(custom).find((a) => a.key === key) ?? {
    key,
    label: key,
    emoji: '🍽️',
    required: false,
  }

/** 献立に登録されているアレルゲンだけを取り出す */
export const usedAllergens = (
  allergens: Record<string, boolean> | null | undefined,
  custom: CustomAllergen[] = []
): AllergenDef[] =>
  mergeAllergens(custom).filter((a) => allergens?.[a.key] === true)

/** 空のアレルゲン状態（標準28品目すべて false） */
export const emptyAllergenState = (): Record<string, boolean> =>
  STANDARD_ALLERGENS.reduce(
    (acc, a) => ({ ...acc, [a.key]: false }),
    {} as Record<string, boolean>
  )

/** 1つでも選ばれているか */
export const hasAnyAllergen = (allergens?: Record<string, boolean> | null) =>
  !!allergens && Object.values(allergens).some((v) => v === true)