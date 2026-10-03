/* app/api/admin/children/list/route.ts
 *
 * 園児一覧の取得。children には RLS が掛かっていて
 * 職員からは読めないため、サーバー経由で取得する。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { toAllergenMap, toUpdatedByRole } from '@/lib/allergens'
import type { ChildListItem, ChildrenListResponse } from '@/lib/apiTypes'

export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { data, error } = await supabaseAdmin
    .from('children_with_account')
    .select('*')
    .eq('school_id', staff.school_id)
    .order('class_name', { ascending: true })
    .order('login_no', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  /* アレルギーは編集・確認の画面で使う。ビューの列に依存しないよう children から取って添える */
  const { data: allergenRows } = await supabaseAdmin
    .from('children')
    .select('id, allergens, allergens_confirmed, allergens_updated_at, allergens_updated_by_role')
    .eq('school_id', staff.school_id)

  const allergyOf = new Map((allergenRows ?? []).map((c) => [c.id, c]))

  /* ビューの列は型の上では空を許すため、id のない行は除き、残りは既定値で埋める */
  const children: ChildListItem[] = (data ?? []).flatMap((c) => {
    if (!c.id) return []
    const a = allergyOf.get(c.id)
    return [{
      id: c.id,
      login_no: c.login_no ?? '',
      name: c.name ?? '',
      class_name: c.class_name,
      has_account: c.has_account === true,
      last_seen_at: c.last_seen_at,
      allergens: toAllergenMap(a?.allergens),
      allergens_confirmed: toAllergenMap(a?.allergens_confirmed),
      allergens_updated_at: a?.allergens_updated_at ?? null,
      allergens_updated_by_role: toUpdatedByRole(a?.allergens_updated_by_role),
    }]
  })

  return NextResponse.json<ChildrenListResponse>({ children })
}