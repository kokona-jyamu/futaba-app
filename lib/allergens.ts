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

/**
 * 画面から届いたアレルギー情報を検証する（API 用）。
 * 標準28品目のキーと true / false 以外が含まれていたら受け付けない。
 */
export function sanitizeAllergens(
  input: unknown
): { ok: true; allergens: Record<string, boolean> } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'アレルギーの形式が不正です' }
  }

  const allergens: Record<string, boolean> = {}
  for (const [key, on] of Object.entries(input)) {
    if (!STANDARD_ALLERGENS.some((a) => a.key === key) || typeof on !== 'boolean') {
      return { ok: false, error: `不明な項目です：${key}` }
    }
    allergens[key] = on
  }
  return { ok: true, allergens }
}

/* ----------------------------------------------------------------
   職員の確認（保護者が変更した内容を、園が確認するための仕組み）

   children.allergens           … 現在の内容（保護者・職員のどちらも変更できる）
   children.allergens_confirmed … 職員が最後に確認した内容
   この2つに差があれば「未確認の変更あり」とみなす。
   ---------------------------------------------------------------- */

/** 選ばれている（true の）キーだけを並べる */
const onKeys = (allergens?: Record<string, boolean> | null): string[] =>
  Object.entries(allergens ?? {}).filter(([, on]) => on === true).map(([key]) => key)

/** 確認済みの内容からの差分。added は増えたもの、removed は外されたもの */
export function allergenDiff(
  current?: Record<string, boolean> | null,
  confirmed?: Record<string, boolean> | null
): { added: string[]; removed: string[] } {
  const now = new Set(onKeys(current))
  const before = new Set(onKeys(confirmed))
  return {
    added: [...now].filter((k) => !before.has(k)),
    removed: [...before].filter((k) => !now.has(k)),
  }
}

/** 職員がまだ確認していない変更があるか */
export const isAllergyPending = (
  current?: Record<string, boolean> | null,
  confirmed?: Record<string, boolean> | null
): boolean => {
  const { added, removed } = allergenDiff(current, confirmed)
  return added.length > 0 || removed.length > 0
}

/**
 * 食数に使うアレルギー。確認待ちの間は、変更前と変更後の
 * どちらかで選ばれていれば除去の対象とする（安全側に寄せる）。
 */
export const effectiveAllergens = (
  current?: Record<string, boolean> | null,
  confirmed?: Record<string, boolean> | null
): Record<string, boolean> =>
  [...onKeys(current), ...onKeys(confirmed)].reduce(
    (acc, key) => ({ ...acc, [key]: true }),
    {} as Record<string, boolean>
  )

/** 1つでも選ばれているか */
export const hasAnyAllergen = (allergens?: Record<string, boolean> | null) =>
  !!allergens && Object.values(allergens).some((v) => v === true)