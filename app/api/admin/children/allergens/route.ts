/* app/api/admin/children/allergens/route.ts
 *
 * 職員による園児のアレルギー情報の登録・変更。
 * 保護者がマイページで登録した内容と同じ列（children.allergens）を更新する。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { sanitizeAllergens } from '@/lib/allergens'

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
   PATCH: 園児のアレルギーを更新する
   body: { child_id, allergens: { [key]: boolean } }
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

  const parsed = sanitizeAllergens(body?.allergens)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  /* 他園の園児を操作できないよう school_id で絞る */
  const { data, error } = await supabaseAdmin
    .from('children')
    .update({ allergens: parsed.allergens })
    .eq('id', child_id)
    .eq('school_id', staff.school_id)
    .select('id, allergens')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '対象の園児が見つかりません' }, { status: 404 })

  return NextResponse.json({ child: data })
}
