/* app/api/admin/menus/route.ts
 *
 * 献立の作成・更新・削除。
 * RLS を掛けた後は、職員の書き込みはすべてここを通す。
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

/** 受け取った値から、DBに入れてよい項目だけを取り出す */
function pickMenuFields(body: any) {
  return {
    served_date: body.served_date,
    title: body.title,
    ingredients: body.ingredients ?? null,
    nutritionist_comment: body.nutritionist_comment ?? null,
    why_eat_note: body.why_eat_note ?? null,
    kcal: body.kcal ?? null,
    carb: body.carb ?? null,
    protein: body.protein ?? null,
    fat: body.fat ?? null,
    salt: body.salt ?? null,
    calcium: body.calcium ?? null,
    allergens: body.allergens ?? {},
    allergen_checked: body.allergen_checked === true,
    photo_url: body.photo_url ?? null,
    is_published: body.is_published !== false,
  }
}

/* ================================================================
   POST: 献立を作る
   ================================================================ */
export async function POST(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  if (!body?.served_date || !body?.title) {
    return NextResponse.json({ error: '日付と献立名は必須です' }, { status: 400 })
  }
  if (body.allergen_checked !== true) {
    return NextResponse.json(
      { error: 'アレルギーの確認が済んでいません' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('menus')
    .insert({ ...pickMenuFields(body), school_id: staff.school_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ menu: data })
}

/* ================================================================
   PATCH: 献立を更新する
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

  if (body.allergen_checked !== true) {
    return NextResponse.json(
      { error: 'アレルギーの確認が済んでいません' },
      { status: 400 }
    )
  }

  /* 他園の献立を触れないよう school_id で絞る */
  const { data, error } = await supabaseAdmin
    .from('menus')
    .update(pickMenuFields(body))
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })

  return NextResponse.json({ menu: data })
}

/* ================================================================
   DELETE: 献立を消す
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
    .from('menus')
    .delete()
    .eq('id', id)
    .eq('school_id', staff.school_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}