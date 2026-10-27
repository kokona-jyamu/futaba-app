/* app/api/events/route.ts
 *
 * 食育の一覧（保護者のトップ画面・食育画面）。自分の園の食育だけを返す。
 * 写真は非公開の場所にあるので、時間で切れる表示用の URL（photo_view_url）を付けて返す。
 * ブラウザから food_education_events を直接読まないようにして、ほかの園の食育が見えないようにする。
 */

import { NextResponse } from 'next/server'
import { requireSchoolMember } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPhotoUrls } from '@/lib/eventMedia'
import type { EventsResponse } from '@/lib/apiTypes'

export async function GET() {
  const member = await requireSchoolMember()
  if (member instanceof NextResponse) return member

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .select('*')
    .eq('school_id', member.school_id)
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  /* 表示用の URL は時間で切れるので、ブラウザや途中のサーバーに残さない */
  return NextResponse.json<EventsResponse>(
    { events: await withPhotoUrls(data ?? []) },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
