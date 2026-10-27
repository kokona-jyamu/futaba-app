/* app/api/admin/events/move-photos/route.ts
 *
 * 食育の古い写真（誰でも見られる menu-photos にあるもの）を、園の関係者だけが見られる場所（event-photos）へ移す。
 * 1回だけ使う移し替え。移したあと photo_url を空にし、photo_path に新しい場所を入れる。
 * もとのファイルはここでは消さない（「設定」の「使っていない写真の片付け」で消せるようになる）。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { EVENT_PHOTO_BUCKET } from '@/lib/eventMedia'
import { PHOTO_BUCKET } from '@/lib/photoCleanup'
import type { MoveEventPhotosResponse } from '@/lib/apiTypes'

/** 公開の URL から、menu-photos の中の場所を取り出す */
const pathOfPublicUrl = (url: string) => {
  const m = url.match(/\/menu-photos\/([^?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export async function POST() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { data: events, error } = await supabaseAdmin
    .from('food_education_events')
    .select('id, photo_url')
    .eq('school_id', staff.school_id)
    .is('photo_path', null)
    .not('photo_url', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let moved = 0
  const failed: string[] = []

  for (const e of events ?? []) {
    const from = e.photo_url ? pathOfPublicUrl(e.photo_url) : null
    if (!from) { failed.push(e.id); continue }

    const ext = from.split('.').pop()?.toLowerCase() || 'jpg'
    const to = `${staff.school_id}/event-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const { error: copyError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .copy(from, to, { destinationBucket: EVENT_PHOTO_BUCKET })
    if (copyError) { failed.push(e.id); continue }

    const { error: updateError } = await supabaseAdmin
      .from('food_education_events')
      .update({ photo_path: to, photo_url: null })
      .eq('id', e.id)
      .eq('school_id', staff.school_id)
    if (updateError) {
      /* 行を書き換えられなかったら、コピーしたファイルは使わないので消す */
      await supabaseAdmin.storage.from(EVENT_PHOTO_BUCKET).remove([to])
      failed.push(e.id)
      continue
    }
    moved++
  }

  return NextResponse.json<MoveEventPhotosResponse>({ moved, failed: failed.length })
}
