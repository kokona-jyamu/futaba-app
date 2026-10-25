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
  /** 表示義務品目かどうか */
  required: boolean
}

/** アレルギーの状態（キーごとに使う・使わない） */
export type AllergenMap = Record<string, boolean>

/**
 * DB の jsonb など、形の分からない値をアレルギーの状態に変換する。
 * true / false 以外の値や、オブジェクトでないものは捨てる。
 */
export const toAllergenMap = (value: unknown): AllergenMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const map: AllergenMap = {}
  for (const [key, on] of Object.entries(value)) {
    if (typeof on === 'boolean') map[key] = on
  }
  return map
}

/** 表示義務8品目：投稿画面でも常に表示する */
export const REQUIRED_ALLERGENS: AllergenDef[] = [
  { key: 'egg',       label: '卵', required: true },
  { key: 'milk',      label: '乳', required: true },
  { key: 'wheat',     label: '小麦', required: true },
  { key: 'buckwheat', label: 'そば', required: true },
  { key: 'peanut',    label: '落花生', required: true },
  { key: 'shrimp',    label: 'えび', required: true },
  { key: 'crab',      label: 'かに', required: true },
  { key: 'walnut',    label: 'くるみ', required: true },
]

/** 表示推奨20品目：「もっと見る」で展開する */
export const OPTIONAL_ALLERGENS: AllergenDef[] = [
  { key: 'almond',    label: 'アーモンド', required: false },
  { key: 'abalone',   label: 'あわび', required: false },
  { key: 'squid',     label: 'いか', required: false },
  { key: 'salmonroe', label: 'いくら', required: false },
  { key: 'orange',    label: 'オレンジ', required: false },
  { key: 'cashew',    label: 'カシューナッツ', required: false },
  { key: 'kiwi',      label: 'キウイ', required: false },
  { key: 'beef',      label: '牛肉', required: false },
  { key: 'sesame',    label: 'ごま', required: false },
  { key: 'salmon',    label: 'さけ', required: false },
  { key: 'mackerel',  label: 'さば', required: false },
  { key: 'soy',       label: '大豆', required: false },
  { key: 'chicken',   label: '鶏肉', required: false },
  { key: 'banana',    label: 'バナナ', required: false },
  { key: 'pork',      label: '豚肉', required: false },
  { key: 'matsutake', label: 'まつたけ', required: false },
  { key: 'peach',     label: 'もも', required: false },
  { key: 'yam',       label: 'やまいも', required: false },
  { key: 'apple',     label: 'りんご', required: false },
  { key: 'gelatin',   label: 'ゼラチン', required: false },
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
  /** DB の列。画面では使わない（アレルゲンは文字だけで表示する） */
  emoji: string | null
  sort_order: number
}

/** 標準＋独自をひとつの配列にする */
export const mergeAllergens = (custom: CustomAllergen[] = []): AllergenDef[] => [
  ...STANDARD_ALLERGENS,
  ...custom.map((c) => ({
    key: c.key,
    label: c.label,
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
    required: false,
  }

/** 献立に登録されているアレルゲンだけを取り出す */
export const usedAllergens = (
  allergens: unknown,
  custom: CustomAllergen[] = []
): AllergenDef[] => {
  const map = toAllergenMap(allergens)
  return mergeAllergens(custom).filter((a) => map[a.key] === true)
}

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

/** children.allergens_updated_by_role の値を、決まった2種類に絞る */
export const toUpdatedByRole = (role: string | null | undefined): 'guardian' | 'staff' | null =>
  role === 'guardian' || role === 'staff' ? role : null

/** 選ばれている（true の）キーだけを並べる */
const onKeys = (allergens: unknown): string[] =>
  Object.entries(toAllergenMap(allergens)).filter(([, on]) => on === true).map(([key]) => key)

/** 確認済みの内容からの差分。added は増えたもの、removed は外されたもの */
export function allergenDiff(
  current: unknown,
  confirmed: unknown
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
  current: unknown,
  confirmed: unknown
): boolean => {
  const { added, removed } = allergenDiff(current, confirmed)
  return added.length > 0 || removed.length > 0
}

/**
 * 食数に使うアレルギー。確認待ちの間は、変更前と変更後の
 * どちらかで選ばれていれば除去の対象とする（安全側に寄せる）。
 */
export const effectiveAllergens = (
  current: unknown,
  confirmed: unknown
): Record<string, boolean> =>
  [...onKeys(current), ...onKeys(confirmed)].reduce(
    (acc, key) => ({ ...acc, [key]: true }),
    {} as Record<string, boolean>
  )

/** 1つでも選ばれているか */
export const hasAnyAllergen = (allergens: unknown) =>
  Object.values(toAllergenMap(allergens)).some((v) => v === true)