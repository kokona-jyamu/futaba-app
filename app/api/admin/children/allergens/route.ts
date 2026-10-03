/* app/api/admin/children/allergens/route.ts
 *
 * 職員による園児のアレルギー情報の登録・変更と、保護者が変更した内容の確認。
 * 保護者がマイページで登録した内容と同じ列（children.allergens）を扱う。
 *
 * allergens_confirmed は「職員が最後に確認した内容」。
 * allergens と差があれば未確認として管理画面に知らせる（lib/allergens 参照）。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { sanitizeAllergens, allergenDiff, isAllergyPending } from '@/lib/allergens'

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

/* 1つの文字列のまま書く（連結すると Supabase が結果の型を推論できなくなる） */
const ALLERGY_COLUMNS = 'id, login_no, name, class_name, allergens, allergens_confirmed, allergens_updated_at, allergens_updated_by_role'

/* ================================================================
   GET: 職員がまだ確認していない変更がある園児の一覧
   ================================================================ */
export async function GET() {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const { data, error } = await supabaseAdmin
    .from('children')
    .select(ALLERGY_COLUMNS)
    .eq('school_id', staff.school_id)
    .eq('is_active', true)
    .order('login_no')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const pending = (data ?? [])
    .filter((c) => isAllergyPending(c.allergens, c.allergens_confirmed))
    .map((c) => ({ ...c, ...allergenDiff(c.allergens, c.allergens_confirmed) }))

  return NextResponse.json({ pending })
}

/* ================================================================
   PATCH: アレルギーを更新する／保護者の変更を確認済みにする
   body: { child_id, allergens }              … 職員が編集（そのまま確認済みになる）
       | { child_id, confirm: true, expected } … 画面に出ていた内容を確認済みにする
   ================================================================ */
export async function PATCH(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const child_id = String(body?.child_id ?? '')
  if (!child_id) {
    return NextResponse.json({ error: 'child_id が必要です' }, { status: 400 })
  }

  const now = new Date().toISOString()

  /* ---------------- 確認済みにする ---------------- */
  if (body?.confirm === true) {
    const expected = sanitizeAllergens(body?.expected)
    if (!expected.ok) {
      return NextResponse.json({ error: expected.error }, { status: 400 })
    }

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, allergens')
      .eq('id', child_id)
      .eq('school_id', staff.school_id)
      .maybeSingle()

    if (!child) {
      return NextResponse.json({ error: '対象の園児が見つかりません' }, { status: 404 })
    }

    /* 画面を開いている間に保護者がさらに変えていたら、見ていない内容を確認済みにしない */
    if (isAllergyPending(child.allergens, expected.allergens)) {
      return NextResponse.json(
        { error: '保護者がさらに内容を変更しています。画面を読み込み直してから確認してください。' },
        { status: 409 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('children')
      .update({
        allergens_confirmed: child.allergens ?? {},
        allergens_confirmed_at: now,
        allergens_confirmed_by: staff.id,
      })
      .eq('id', child_id)
      .eq('school_id', staff.school_id)
      .select(ALLERGY_COLUMNS)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ child: data })
  }

  /* ---------------- 職員による編集 ---------------- */
  const parsed = sanitizeAllergens(body?.allergens)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  /* 他園の園児を操作できないよう school_id で絞る */
  const { data, error } = await supabaseAdmin
    .from('children')
    .update({
      allergens: parsed.allergens,
      allergens_updated_at: now,
      allergens_updated_by: staff.id,
      allergens_updated_by_role: 'staff',
      /* 職員が自分で入れた内容は、その時点で確認済みとする */
      allergens_confirmed: parsed.allergens,
      allergens_confirmed_at: now,
      allergens_confirmed_by: staff.id,
    })
    .eq('id', child_id)
    .eq('school_id', staff.school_id)
    .select(ALLERGY_COLUMNS)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '対象の園児が見つかりません' }, { status: 404 })

  return NextResponse.json({ child: data })
}
