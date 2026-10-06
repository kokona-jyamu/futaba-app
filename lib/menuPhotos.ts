/* lib/menuPhotos.ts — 献立の写真と料理の共通処理（クライアント・サーバー共用）
 *
 * menus.tray_photo_url … お盆全体の写真（大）
 * menu_dishes          … その日の献立に入っている料理と、その日の写真
 * dishes               … 園ごとの料理（種類＝タグ・料理名・レシピ）
 *
 * 写真の種類（タグ）は園ごとに school_photo_kinds で決める（初期は 主食・汁物・主菜・副菜）。
 * 使える種類の数は schools.photo_kind_limit まで（標準 4、増やすのは運営者が行う）。
 * 1つの種類に料理を何品でも入れられる。種類を「使わない」にしても、過去の料理と写真は表示する。
 */

import type { Tables } from '@/lib/database.types'

export type PhotoKind = Pick<
  Tables<'school_photo_kinds'>,
  'id' | 'label' | 'preset_key' | 'sort_order' | 'is_active'
>

/** 写真が1枚もない園に用意する初期の種類 */
export const DEFAULT_PHOTO_KINDS = [
  { label: '主食', preset_key: 'staple', sort_order: 10 },
  { label: '汁物', preset_key: 'soup', sort_order: 20 },
  { label: '主菜', preset_key: 'main', sort_order: 30 },
  { label: '副菜', preset_key: 'side', sort_order: 40 },
] as const

/** 種類を追加するときに出す名前の候補（自由に入力もできる） */
export const PHOTO_KIND_SUGGESTIONS = [
  '主食', '汁物', '主菜', '副菜', '果物・デザート', '牛乳', 'おやつ',
]

/** 写真の置き場所（Supabase Storage の menu-photos バケット）の URL か */
export const isMenuPhotoUrl = (url: string): boolean => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !!base && url.startsWith(`${base}/storage/v1/object/public/menu-photos/`)
}

/** 写真の URL を検証する（API 用）。空なら null、置き場所の外の URL は不正 */
export const checkPhotoUrl = (value: unknown): { ok: true; url: string | null } | { ok: false } => {
  if (value === null || value === undefined || value === '') return { ok: true, url: null }
  if (typeof value !== 'string' || !isMenuPhotoUrl(value)) return { ok: false }
  return { ok: true, url: value }
}

/** 種類を並び順に並べる */
export const sortKinds = (kinds: PhotoKind[]): PhotoKind[] =>
  [...kinds].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))

/** 献立の料理の並べ方に必要な項目 */
type OrderableDish = { kind_id: string; sort_order: number }

/** 献立の料理を「種類の並び順 → 献立の中での並び順」で並べる */
export const orderDishes = <T extends OrderableDish>(dishes: T[], kinds: PhotoKind[]): T[] => {
  const kindOrder = new Map(sortKinds(kinds).map((k, i) => [k.id, i]))
  const rank = (d: T) => kindOrder.get(d.kind_id) ?? Number.MAX_SAFE_INTEGER
  return [...dishes].sort((a, b) => rank(a) - rank(b) || a.sort_order - b.sort_order)
}

/**
 * 大きく出す写真（献立詳細の上部・お気に入り・一覧の写真）。
 * お盆全体 → 主菜 → 他の料理（並び順） の順で選ぶ。1枚もなければ null。
 * どの料理の写真を使ったかも返す（料理ごとの一覧で同じ写真を重ねて出さないため）。
 */
export const mainPhotoOf = <T extends OrderableDish & { photo_url: string | null }>(
  trayPhotoUrl: string | null,
  dishes: T[],
  kinds: PhotoKind[]
): { url: string; fromDish: T | null } | null => {
  if (trayPhotoUrl) return { url: trayPhotoUrl, fromDish: null }

  const mainKindIds = new Set(kinds.filter((k) => k.preset_key === 'main').map((k) => k.id))
  const withPhoto = orderDishes(dishes, kinds).filter((d) => d.photo_url)
  const picked = withPhoto.find((d) => mainKindIds.has(d.kind_id)) ?? withPhoto[0]
  return picked ? { url: picked.photo_url!, fromDish: picked } : null
}

/**
 * 画面から届いた「献立の料理」を検証する（API 用）。
 * body の形：[{ dish_id, photo_url }]（並び順どおり）
 * その園の料理だけを受け付け、写真は menu-photos バケットのものだけを受け付ける。
 */
export function sanitizeMenuDishes(
  input: unknown,
  dishIds: Set<string>
):
  | { ok: true; dishes: { dish_id: string; photo_url: string | null; sort_order: number }[] }
  | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, dishes: [] }
  if (!Array.isArray(input)) return { ok: false, error: '料理の指定が不正です' }

  const seen = new Set<string>()
  const dishes: { dish_id: string; photo_url: string | null; sort_order: number }[] = []

  for (const [i, item] of input.entries()) {
    const dishId = String((item as { dish_id?: unknown })?.dish_id ?? '')
    if (!dishIds.has(dishId)) return { ok: false, error: '料理が見つかりません' }
    if (seen.has(dishId)) continue
    seen.add(dishId)

    const photo = checkPhotoUrl((item as { photo_url?: unknown })?.photo_url)
    if (!photo.ok) return { ok: false, error: '料理の写真の指定が不正です' }

    dishes.push({ dish_id: dishId, photo_url: photo.url, sort_order: (i + 1) * 10 })
  }

  return { ok: true, dishes }
}
