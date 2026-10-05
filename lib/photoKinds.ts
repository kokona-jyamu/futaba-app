/* lib/photoKinds.ts — 園ごとの「写真の種類」を読む（サーバー専用）
 *
 * school_photo_kinds はブラウザから読めないようにしているため、
 * 管理画面の API と、保護者向けのサーバー側の処理からここを使う。
 */

import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { DEFAULT_PHOTO_KINDS, sortKinds, type PhotoKind } from '@/lib/menuPhotos'

const KIND_COLUMNS = 'id, label, preset_key, sort_order, is_active'

/** 園の写真の種類（並び順）。まだ1つもない園には初期の4種を用意してから返す */
export async function getPhotoKinds(schoolId: string): Promise<PhotoKind[]> {
  const { data } = await supabaseAdmin
    .from('school_photo_kinds')
    .select(KIND_COLUMNS)
    .eq('school_id', schoolId)

  if (data && data.length > 0) return sortKinds(data)

  await supabaseAdmin
    .from('school_photo_kinds')
    .upsert(
      DEFAULT_PHOTO_KINDS.map((k) => ({ ...k, school_id: schoolId })),
      { onConflict: 'school_id,preset_key', ignoreDuplicates: true }
    )

  const { data: created } = await supabaseAdmin
    .from('school_photo_kinds')
    .select(KIND_COLUMNS)
    .eq('school_id', schoolId)

  return sortKinds(created ?? [])
}

/** 園が使える写真の種類の数（標準 4。増やすのは運営者が SQL で行う） */
export async function getPhotoKindLimit(schoolId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('schools')
    .select('photo_kind_limit')
    .eq('id', schoolId)
    .maybeSingle()
  return data?.photo_kind_limit ?? 4
}
