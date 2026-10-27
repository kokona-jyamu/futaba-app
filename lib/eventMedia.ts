/* lib/eventMedia.ts — 食育の写真・動画を、園の関係者だけに見せる（サーバー専用）
 *
 * 食育の写真は子どもが写るので、献立の写真（公開の menu-photos）とは別の、非公開の保存場所に置く。
 * 画面には、そのつど時間で切れる表示用の URL を発行して渡す。
 * 初めのころの写真は公開の場所（photo_url）にあるので、移すまではそちらをそのまま使う。
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Tables } from '@/lib/database.types'
import type { FoodEvent } from '@/lib/apiTypes'

export const EVENT_PHOTO_BUCKET = 'event-photos'

/** 表示用の URL が使える時間（秒）。開いたままの画面でも写真が消えないよう、長めにする */
const PHOTO_URL_SECONDS = 6 * 60 * 60

/** 自分の園のフォルダの場所だけ受け付ける（ほかの園のファイルを付けられないように） */
export function ownPath(value: unknown, schoolId: string): string | null {
  if (typeof value !== 'string' || !value) return null
  return value.startsWith(`${schoolId}/`) && !value.includes('..') ? value : null
}

/** 食育の一覧に、写真の表示用 URL（photo_view_url）を付ける */
export async function withPhotoUrls(events: Tables<'food_education_events'>[]): Promise<FoodEvent[]> {
  const paths = events.flatMap((e) => (e.photo_path ? [e.photo_path] : []))
  const signed = new Map<string, string>()

  if (paths.length > 0) {
    const { data } = await supabaseAdmin.storage.from(EVENT_PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS)
    for (const d of data ?? []) {
      if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl)
    }
  }

  return events.map((e) => ({
    ...e,
    photo_view_url: e.photo_path ? signed.get(e.photo_path) ?? null : e.photo_url,
  }))
}
