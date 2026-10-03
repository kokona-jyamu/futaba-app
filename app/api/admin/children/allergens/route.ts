/* app/api/admin/children/allergens/route.ts
 *
 * 職員による園児のアレルギー情報の登録・変更と、保護者が変更した内容の確認。
 * 保護者がマイページで登録した内容と同じ列（children.allergens）を扱う。
 *
 * allergens_confirmed は「職員が最後に確認した内容」。
 * allergens と差があれば未確認として管理画面に知らせる（lib/allergens 参照）。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  sanitizeAllergens, allergenDiff, isAllergyPending, toAllergenMap, toUpdatedByRole,
} from '@/lib/allergens'
import type {
  AllergyPendingChild, AllergyPendingResponse, AllergyUpdateResponse,
} from '@/lib/apiTypes'

/* 1つの文字列のまま書く（連結すると Supabase が結果の型を推論できなくなる） */
const ALLERGY_COLUMNS = 'id, login_no, name, class_name, allergens, allergens_confirmed, allergens_updated_at, allergens_updated_by_role'

/** 画面に返す形（AllergyUpdateResponse）に整える */
const toAllergyInfo = (c: {
  id: string
  allergens: unknown
  allergens_confirmed: unknown
  allergens_updated_at: string | null
  allergens_updated_by_role: string | null
}): AllergyUpdateResponse['child'] => ({
  id: c.id,
  allergens: toAllergenMap(c.allergens),
  allergens_confirmed: toAllergenMap(c.allergens_confirmed),
  allergens_updated_at: c.allergens_updated_at,
  allergens_updated_by_role: toUpdatedByRole(c.allergens_updated_by_role),
})

/* ================================================================
   GET: 職員がまだ確認していない変更がある園児の一覧
   ================================================================ */
export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { data, error } = await supabaseAdmin
    .from('children')
    .select(ALLERGY_COLUMNS)
    .eq('school_id', staff.school_id)
    .eq('is_active', true)
    .order('login_no')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const pending: AllergyPendingChild[] = (data ?? [])
    .filter((c) => isAllergyPending(c.allergens, c.allergens_confirmed))
    .map((c) => ({
      id: c.id, login_no: c.login_no, name: c.name, class_name: c.class_name,
      ...allergenDiff(c.allergens, c.allergens_confirmed),
    }))

  return NextResponse.json<AllergyPendingResponse>({ pending })
}

/* ================================================================
   PATCH: アレルギーを更新する／保護者の変更を確認済みにする
   body: { child_id, allergens }              … 職員が編集（そのまま確認済みになる）
       | { child_id, confirm: true, expected } … 画面に出ていた内容を確認済みにする
   ================================================================ */
export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

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
    if (!data) return NextResponse.json({ error: '対象の園児が見つかりません' }, { status: 404 })
    return NextResponse.json<AllergyUpdateResponse>({ child: toAllergyInfo(data) })
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

  return NextResponse.json<AllergyUpdateResponse>({ child: toAllergyInfo(data) })
}
