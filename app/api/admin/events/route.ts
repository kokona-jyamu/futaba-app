/* app/api/admin/events/route.ts
 *
 * 食育イベントの登録・更新・削除・一覧。
 * 予告と記録の区別は event_date で判定するため、status は保存しない。
 * 写真と動画は非公開の保存場所に置き、場所（photo_path / video_path）だけを保存する。
 * 写真・動画を差し替え・外したとき、食育を消したときは、もとのファイルも消す（食育の写真・動画は使い回さない）。
 * 初めのころの写真は公開の場所の URL（photo_url）のまま。新しい写真を入れたら photo_url は空にする。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { EventsResponse } from '@/lib/apiTypes'
import { isDateStr } from '@/lib/date'
import { str, strList, type Body } from '@/lib/parse'
import { VIDEO_BUCKET } from '@/lib/videos'
import { EVENT_PHOTO_BUCKET, ownPath, withPhotoUrls } from '@/lib/eventMedia'

/** ファイルを消す（失敗しても食育の保存は取り消さない。残ったファイルは容量を使うだけ） */
async function removeFile(bucket: string, path: string | null | undefined) {
  if (path) await supabaseAdmin.storage.from(bucket).remove([path])
}

/** 受け取った値から、DBに入れてよい項目だけを取り出す。日付と行事名は必須 */
function pickFields(body: Body, schoolId: string) {
  const event_date = body.event_date
  const title = str(body.title)
  if (!isDateStr(event_date) || !title) return null

  const photo_path = ownPath(body.photo_path, schoolId)
  return {
    event_date,
    title,
    description: str(body.description),
    photo_path,
    /* 新しい写真を入れたら、公開の場所の古い写真は使わない */
    photo_url: photo_path ? null : str(body.photo_url),
    recipe_title: str(body.recipe_title),
    recipe_ingredients: strList(body.recipe_ingredients),
    recipe_steps: str(body.recipe_steps),
    video_path: ownPath(body.video_path, schoolId),
  }
}

/* ================================================================
   GET: 一覧（写真の表示用 URL つき）
   ================================================================ */
export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .select('*')
    .eq('school_id', staff.school_id)
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json<EventsResponse>(
    { events: await withPhotoUrls(data ?? []) },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}

/* ================================================================
   POST: 新規登録
   ================================================================ */
export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const fields = pickFields(body, staff.school_id)
  if (!fields) {
    return NextResponse.json({ error: '日付と行事名は必須です' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .insert({ ...fields, school_id: staff.school_id, status: 'auto' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ event: data })
}

/* ================================================================
   PATCH: 更新
   ================================================================ */
export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const fields = pickFields(body, staff.school_id)
  if (!fields) {
    return NextResponse.json({ error: '日付と行事名は必須です' }, { status: 400 })
  }

  /* 差し替え・外した写真と動画を、保存のあとで消すために覚えておく */
  const { data: before } = await supabaseAdmin
    .from('food_education_events')
    .select('photo_path, video_path')
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .update(fields)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })

  if (before?.photo_path !== data.photo_path) await removeFile(EVENT_PHOTO_BUCKET, before?.photo_path)
  if (before?.video_path !== data.video_path) await removeFile(VIDEO_BUCKET, before?.video_path)

  return NextResponse.json({ event: data })
}

/* ================================================================
   DELETE: 削除
   ================================================================ */
export async function DELETE(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .delete()
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select('photo_path, video_path')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await removeFile(EVENT_PHOTO_BUCKET, data?.photo_path)
  await removeFile(VIDEO_BUCKET, data?.video_path)
  return NextResponse.json({ ok: true })
}
