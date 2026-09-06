/* app/api/admin/meal-types/route.ts
 *
 * 食事区分（3分食・幼児食など）の設定と、園児への割り当て。
 * 区分は園ごとに自由に定義できる。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { todayStr } from '@/lib/attendance'

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

/* ================================================================
   GET: 区分の一覧と、園児ごとの現在の区分
   ================================================================ */
export async function GET() {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const { data: mealTypes } = await supabaseAdmin
    .from('meal_types')
    .select('*')
    .eq('school_id', staff.school_id)
    .order('sort_order')

  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, login_no, name, class_name')
    .eq('school_id', staff.school_id)
    .eq('is_active', true)
    .order('login_no')

  const ids = (children ?? []).map((c) => c.id)

  const { data: history } = ids.length
    ? await supabaseAdmin
        .from('child_meal_types')
        .select('*')
        .in('child_id', ids)
        .order('start_date', { ascending: false })
    : { data: [] as any[] }

  const today = todayStr()
  const current = new Map<string, any>()
  ;(history ?? []).forEach((h) => {
    if (h.start_date <= today && !current.has(h.child_id)) current.set(h.child_id, h)
  })

  return NextResponse.json({
    mealTypes: mealTypes ?? [],
    children: (children ?? []).map((c) => ({
      ...c,
      meal_type_id: current.get(c.id)?.meal_type_id ?? null,
      start_date: current.get(c.id)?.start_date ?? null,
    })),
    history: history ?? [],
  })
}

/* ================================================================
   POST: 区分を追加する
   body: { name, is_baby, sort_order }
   ================================================================ */
export async function POST(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const name = String(body?.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: '区分の名前を入力してください' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('meal_types')
    .insert({
      school_id: staff.school_id,
      name,
      is_baby: body?.is_baby === true,
      sort_order: Number(body?.sort_order ?? 100),
    })
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'その名前はすでにあります' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ mealType: data })
}

/* ================================================================
   PATCH: 区分の変更、または園児への割り当て
   body: { id, name, is_baby, sort_order, is_active }
        | { child_id, meal_type_id, start_date }
   ================================================================ */
export async function PATCH(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)

  /* 園児への割り当て */
  if (body?.child_id) {
    const child_id = String(body.child_id)
    const meal_type_id = String(body.meal_type_id ?? '')
    const start_date = String(body.start_date || todayStr())

    if (!meal_type_id) {
      return NextResponse.json({ error: '区分を選んでください' }, { status: 400 })
    }

    /* 自園の園児か確認 */
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id')
      .eq('id', child_id)
      .eq('school_id', staff.school_id)
      .maybeSingle()

    if (!child) {
      return NextResponse.json({ error: '対象の園児が見つかりません' }, { status: 404 })
    }

    /* 同じ日に既にあれば置き換える */
    await supabaseAdmin
      .from('child_meal_types')
      .delete()
      .eq('child_id', child_id)
      .eq('start_date', start_date)

    const { data, error } = await supabaseAdmin
      .from('child_meal_types')
      .insert({ child_id, meal_type_id, start_date })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ assigned: data })
  }

  /* 区分そのものの変更 */
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.is_baby !== undefined) patch.is_baby = body.is_baby === true
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order)
  if (body.is_active !== undefined) patch.is_active = body.is_active === true

  const { data, error } = await supabaseAdmin
    .from('meal_types')
    .update(patch)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ mealType: data })
}