/* app/api/admin/events/route.ts
 *
 * 食育イベントの登録・更新・削除・一覧。
 * 予告と記録の区別は event_date で判定するため、status は保存しない。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'

const STAFF_ROLES = ['nutritionist', 'admin']

async function requireStaff() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    throw NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  return profile
}

function pickFields(body: any) {
  return {
    event_date: body.event_date,
    title: body.title,
    description: body.description || null,
    photo_url: body.photo_url || null,
    recipe_title: body.recipe_title || null,
    recipe_ingredients: Array.isArray(body.recipe_ingredients) && body.recipe_ingredients.length > 0
      ? body.recipe_ingredients
      : null,
    recipe_steps: body.recipe_steps || null,
  }
}

/* ================================================================
   GET: 一覧
   ================================================================ */
export async function GET() {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .select('*')
    .eq('school_id', staff.school_id)
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ events: data ?? [] })
}

/* ================================================================
   POST: 新規登録
   ================================================================ */
export async function POST(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  if (!body?.event_date || !body?.title) {
    return NextResponse.json({ error: '日付と行事名は必須です' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .insert({ ...pickFields(body), school_id: staff.school_id, status: 'auto' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ event: data })
}

/* ================================================================
   PATCH: 更新
   ================================================================ */
export async function PATCH(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('food_education_events')
    .update(pickFields(body))
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
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

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