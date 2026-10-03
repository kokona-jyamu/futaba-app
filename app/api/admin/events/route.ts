/* app/api/admin/events/route.ts
 *
 * 食育イベントの登録・更新・削除・一覧。
 * 予告と記録の区別は event_date で判定するため、status は保存しない。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { EventsResponse } from '@/lib/apiTypes'
import { isDateStr } from '@/lib/date'
import { str, strList, type Body } from '@/lib/parse'

/** 受け取った値から、DBに入れてよい項目だけを取り出す。日付と行事名は必須 */
function pickFields(body: Body) {
  const event_date = body.event_date
  const title = str(body.title)
  if (!isDateStr(event_date) || !title) return null

  return {
    event_date,
    title,
    description: str(body.description),
    photo_url: str(body.photo_url),
    recipe_title: str(body.recipe_title),
    recipe_ingredients: strList(body.recipe_ingredients),
    recipe_steps: str(body.recipe_steps),
  }
}

/* ================================================================
   GET: 一覧
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
  return NextResponse.json<EventsResponse>({ events: data ?? [] })
}

/* ================================================================
   POST: 新規登録
   ================================================================ */
export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const fields = pickFields(body)
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

  const fields = pickFields(body)
  if (!fields) {
    return NextResponse.json({ error: '日付と行事名は必須です' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .update(fields)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })

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

  const { error } = await supabaseAdmin
    .from('food_education_events')
    .delete()
    .eq('id', id)
    .eq('school_id', staff.school_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}