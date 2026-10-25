/* app/api/events/likes/route.ts
 *
 * 食育イベントの「いいね」。ログインした保護者に結び付ける（1つのイベントに1人1回）。
 * 数えるのは自分の園のイベントだけ。付け外しは自分のいいねだけ。
 * event_likes はブラウザから触れないため、読み書きはここを通す。
 *
 * guardian_id が空の行は、端末ごとのIDで数えていた頃のいいね。件数には含めるが、付け外しはできない。
 */

import { NextResponse } from 'next/server'
import { requireGuardian } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Body } from '@/lib/parse'
import type { EventLikesResponse, EventLikeResponse } from '@/lib/apiTypes'

/** 自分の園のイベントか */
async function isOwnEvent(eventId: string, schoolId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('food_education_events')
    .select('id')
    .eq('id', eventId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return !!data
}

/** そのイベントのいいねの数 */
async function countOf(eventId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('event_likes')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
  return count ?? 0
}

/* ================================================================
   GET: 自分の園のイベントごとのいいねの数と、自分がいいねしたイベント
   ================================================================ */
export async function GET() {
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const { data, error } = await supabaseAdmin
    .from('event_likes')
    .select('event_id, guardian_id, food_education_events!inner(school_id)')
    .eq('food_education_events.school_id', guardian.school_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const counts: Record<string, number> = {}
  const mine: string[] = []
  for (const like of data ?? []) {
    if (!like.event_id) continue
    counts[like.event_id] = (counts[like.event_id] ?? 0) + 1
    if (like.guardian_id === guardian.id) mine.push(like.event_id)
  }

  return NextResponse.json<EventLikesResponse>({ counts, mine })
}

/* ================================================================
   POST: いいねを付ける・外す
   body: { event_id, liked: true（付ける）| false（外す） }
   ================================================================ */
export async function POST(req: Request) {
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const eventId = String(body.event_id ?? '')
  if (!eventId || typeof body.liked !== 'boolean') {
    return NextResponse.json({ error: '指定が不正です' }, { status: 400 })
  }
  if (!(await isOwnEvent(eventId, guardian.school_id))) {
    return NextResponse.json({ error: '対象の食育イベントが見つかりません' }, { status: 404 })
  }

  if (body.liked) {
    /* 2回押されても1件だけにする */
    const { error } = await supabaseAdmin
      .from('event_likes')
      .upsert(
        { event_id: eventId, guardian_id: guardian.id },
        { onConflict: 'event_id,guardian_id', ignoreDuplicates: true }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    /* 外せるのは自分のいいねだけ */
    const { error } = await supabaseAdmin
      .from('event_likes')
      .delete()
      .eq('event_id', eventId)
      .eq('guardian_id', guardian.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json<EventLikeResponse>({
    event_id: eventId,
    liked: body.liked,
    count: await countOf(eventId),
  })
}
