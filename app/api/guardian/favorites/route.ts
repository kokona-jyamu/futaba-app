/* app/api/guardian/favorites/route.ts
 *
 * 保護者のお気に入り一覧。
 * 小さい写真は「お盆全体 → 主菜 → 他の料理」の順で選ぶ。
 * 写真の種類（school_photo_kinds）はブラウザから読めないため、ここで決めて返す。
 * お気に入りの登録・解除は、これまでどおりブラウザから favorites に直接行う。
 */

import { NextResponse } from 'next/server'
import { requireGuardian } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPhotoKinds } from '@/lib/photoKinds'
import { mainPhotoOf } from '@/lib/menuPhotos'
import type { FavoritesResponse } from '@/lib/apiTypes'

export async function GET() {
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const { data, error } = await supabaseAdmin
    .from('favorites')
    .select('created_at, menus(id, served_date, title, tray_photo_url, dish_photos, is_published, school_id)')
    .eq('guardian_id', guardian.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const kinds = await getPhotoKinds(guardian.school_id)

  /* 下書きに戻された献立や、他園の献立は出さない */
  const favorites = (data ?? []).flatMap((f) => {
    const m = f.menus
    if (!m || !m.is_published || m.school_id !== guardian.school_id) return []
    return [{
      menu_id: m.id,
      served_date: m.served_date,
      title: m.title,
      photo_url: mainPhotoOf(m, kinds)?.url ?? null,
    }]
  })

  return NextResponse.json<FavoritesResponse>({ favorites })
}
