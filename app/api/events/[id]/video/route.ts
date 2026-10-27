/* app/api/events/[id]/video/route.ts
 *
 * 食育の動画を見るための、時間で切れる URL を発行する。
 * その食育と同じ園の保護者・職員にだけ発行する（ほかの園の人や、ログインしていない人には出さない）。
 */

import { NextResponse } from 'next/server'
import { requireSchoolMember } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { VIDEO_BUCKET, VIDEO_URL_SECONDS } from '@/lib/videos'
import type { VideoUrlResponse } from '@/lib/apiTypes'

type Props = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const member = await requireSchoolMember()
  if (member instanceof NextResponse) return member

  const { id } = await params
  const { data: event } = await supabaseAdmin
    .from('food_education_events')
    .select('video_path')
    .eq('id', id)
    .eq('school_id', member.school_id)
    .maybeSingle()

  if (!event?.video_path) {
    return NextResponse.json({ error: '動画が見つかりません' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(event.video_path, VIDEO_URL_SECONDS)
  if (error || !data) {
    return NextResponse.json({ error: '動画を読み込めませんでした' }, { status: 500 })
  }

  /* URL は時間で切れるので、ブラウザや途中のサーバーに残さない */
  return NextResponse.json<VideoUrlResponse>(
    { url: data.signedUrl },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
