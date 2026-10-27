/* lib/photoCleanup.ts — どこからも使われていない写真ファイルを探す（サーバー専用）
 *
 * 写真は画面から直接 Storage（menu-photos）に入れ、その URL を献立・料理・食育の行事に保存している。
 * 保存せずに閉じた・写真を差し替えた・献立を消した、などで使われなくなったファイルが残るので、ここで探す。
 *
 * 安全のため：
 *  - 「前回の写真を使う」で同じファイルを何日も使うので、1件ずつではなく、すべての参照を集めてから比べる
 *  - 参照は園を問わずすべての行から集める（どこかで使われていれば消さない）
 *  - アップロードしてから GRACE_DAYS 日たっていないものは消さない（いま入力中の献立の写真を守る）
 *  - 参照を1つでも読めなかったときは、何も消さない
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const PHOTO_BUCKET = 'menu-photos'
export const GRACE_DAYS = 7

const PAGE = 1000

export type UnusedPhoto = { path: string; size: number; created_at: string | null }

/** 文字列（URL や JSON）の中から、menu-photos の中のファイルの場所を取り出す */
function collectPaths(value: unknown, into: Set<string>) {
  if (value === null || value === undefined) return
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  for (const m of text.matchAll(/\/menu-photos\/([^"'?#\s\\]+)/g)) {
    try { into.add(decodeURIComponent(m[1])) } catch { into.add(m[1]) }
  }
}

/** 1000行ずつ読んで、すべての行を返す（Supabase は1回に1000行までしか返さない） */
async function fetchAll<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/** 献立・料理・食育の行事から、使われている写真の場所をすべて集める */
async function usedPaths(): Promise<Set<string>> {
  const used = new Set<string>()

  const menus = await fetchAll((from, to) =>
    supabaseAdmin.from('menus').select('id, tray_photo_url, photo_url, dish_photos').order('id').range(from, to)
  )
  menus.forEach((m) => { collectPaths(m.tray_photo_url, used); collectPaths(m.photo_url, used); collectPaths(m.dish_photos, used) })

  const menuDishes = await fetchAll((from, to) =>
    supabaseAdmin.from('menu_dishes').select('id, photo_url').not('photo_url', 'is', null).order('id').range(from, to)
  )
  menuDishes.forEach((d) => collectPaths(d.photo_url, used))

  const events = await fetchAll((from, to) =>
    supabaseAdmin.from('food_education_events').select('id, photo_url').not('photo_url', 'is', null).order('id').range(from, to)
  )
  events.forEach((e) => collectPaths(e.photo_url, used))

  return used
}

/** フォルダの中のファイルをすべて返す（folder が '' のときは一番上） */
async function listFiles(folder: string) {
  const files: { path: string; size: number; created_at: string | null }[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .list(folder, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    for (const f of data ?? []) {
      /* id が null のものはフォルダ */
      if (!f.id) continue
      files.push({ path: folder ? `${folder}/${f.name}` : f.name, size: Number(f.metadata?.size ?? 0), created_at: f.created_at })
    }
    if (!data || data.length < PAGE) return files
  }
}

/**
 * 園のフォルダのファイル。
 * 初めのころは園のフォルダを作らず一番上に入れていたので、一番上のファイルも含める
 * （参照はすべての園から集めているので、どこかの園で使っていれば消さない）。
 */
async function listSchoolFiles(schoolId: string) {
  const [inFolder, atTop] = await Promise.all([listFiles(schoolId), listFiles('')])
  return [...inFolder, ...atTop]
}

/** 園のフォルダの中で、どこからも使われておらず、GRACE_DAYS 日以上前に入れた写真 */
export async function findUnusedPhotos(schoolId: string): Promise<UnusedPhoto[]> {
  const [files, used] = await Promise.all([listSchoolFiles(schoolId), usedPaths()])
  const limit = Date.now() - GRACE_DAYS * 86400000
  return files.filter(
    (f) => !used.has(f.path) && f.created_at !== null && new Date(f.created_at).getTime() < limit
  )
}

/** 写真の場所から、表示用の URL を作る */
export const photoUrlOf = (path: string) =>
  supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
