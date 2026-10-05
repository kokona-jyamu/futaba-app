/* lib/menuPhotos.ts — 献立の写真（お盆全体＋料理ごと）の共通処理（クライアント・サーバー共用）
 *
 * menus.tray_photo_url … お盆全体の写真（大）
 * menus.dish_photos    … 料理ごとの写真 { 写真の種類のID: URL }
 *
 * 写真の種類は園ごとに school_photo_kinds で決める（初期は 主食・汁物・主菜・副菜）。
 * 使える種類の数は schools.photo_kind_limit まで（標準 4、増やすのは運営者が行う）。
 * 種類を「使わない」にしても、過去の献立に入れた写真は表示する。
 */

import type { Tables } from '@/lib/database.types'

export type PhotoKind = Pick<
  Tables<'school_photo_kinds'>,
  'id' | 'label' | 'preset_key' | 'sort_order' | 'is_active'
>

/** 料理ごとの写真 { 種類のID: URL } */
export type DishPhotos = Record<string, string>

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

/** DB の jsonb など、形の分からない値を { 種類のID: URL } に変換する。URL 以外は捨てる */
export const toDishPhotos = (value: unknown): DishPhotos => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const photos: DishPhotos = {}
  for (const [kindId, url] of Object.entries(value)) {
    if (typeof url === 'string' && url.trim() !== '') photos[kindId] = url
  }
  return photos
}

/** 写真の置き場所（Supabase Storage の menu-photos バケット）の URL か */
export const isMenuPhotoUrl = (url: string): boolean => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !!base && url.startsWith(`${base}/storage/v1/object/public/menu-photos/`)
}

/**
 * 画面から届いた写真の値を検証する（API 用）。
 *  - tray : お盆全体の写真。空なら null
 *  - dish : { 種類のID: URL }。その園の種類のIDだけを受け付ける
 * URL は menu-photos バケットのものだけを受け付ける。
 */
export function sanitizeMenuPhotos(
  input: { tray: unknown; dish: unknown },
  kindIds: Set<string>
): { ok: true; tray: string | null; dish: DishPhotos } | { ok: false; error: string } {
  let tray: string | null = null
  if (input.tray !== null && input.tray !== undefined && input.tray !== '') {
    if (typeof input.tray !== 'string' || !isMenuPhotoUrl(input.tray)) {
      return { ok: false, error: 'お盆全体の写真の指定が不正です' }
    }
    tray = input.tray
  }

  const dish: DishPhotos = {}
  if (input.dish !== null && input.dish !== undefined) {
    if (typeof input.dish !== 'object' || Array.isArray(input.dish)) {
      return { ok: false, error: '料理ごとの写真の指定が不正です' }
    }
    for (const [kindId, url] of Object.entries(input.dish)) {
      if (url === null || url === '') continue
      if (!kindIds.has(kindId)) return { ok: false, error: '写真の種類が見つかりません' }
      if (typeof url !== 'string' || !isMenuPhotoUrl(url)) {
        return { ok: false, error: '料理ごとの写真の指定が不正です' }
      }
      dish[kindId] = url
    }
  }

  return { ok: true, tray, dish }
}

/** 種類を並び順に並べる */
export const sortKinds = (kinds: PhotoKind[]): PhotoKind[] =>
  [...kinds].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))

/** 料理ごとの写真を、種類の並び順で並べる（使わなくなった種類の写真も含める） */
export const dishPhotoList = (
  dishPhotos: unknown,
  kinds: PhotoKind[]
): { kind: PhotoKind; url: string }[] => {
  const photos = toDishPhotos(dishPhotos)
  return sortKinds(kinds)
    .filter((k) => photos[k.id])
    .map((k) => ({ kind: k, url: photos[k.id] }))
}

/**
 * 大きく出す写真（献立詳細の上部・お気に入りの写真）。
 * お盆全体 → 主菜 → 他の料理（並び順） の順で選ぶ。1枚もなければ null。
 * どの料理の写真を使ったかも返す（料理ごとの一覧で同じ写真を重ねて出さないため）。
 */
export const mainPhotoOf = (
  menu: { tray_photo_url: string | null; dish_photos: unknown },
  kinds: PhotoKind[]
): { url: string; fromKindId: string | null } | null => {
  if (menu.tray_photo_url) return { url: menu.tray_photo_url, fromKindId: null }

  const list = dishPhotoList(menu.dish_photos, kinds)
  const main = list.find((p) => p.kind.preset_key === 'main') ?? list[0]
  return main ? { url: main.url, fromKindId: main.kind.id } : null
}
