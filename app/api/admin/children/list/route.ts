/* app/api/admin/children/list/route.ts
 *
 * 園児一覧の取得。children には RLS が掛かっていて
 * 職員からは読めないため、サーバー経由で取得する。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { toAllergenMap, toUpdatedByRole } from '@/lib/allergens'
import { LEGACY_PIN_LOGIN_UNTIL, lockKeyOf } from '@/lib/pinAuth'
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

  /* ログインの仕組み（新しい仕組みに切り替わったか）とロックの状態 */
  const guardianIds = (data ?? []).flatMap((c) => (c.guardian_id ? [c.guardian_id] : []))
  const loginNos = (data ?? []).flatMap((c) => (c.login_no ? [lockKeyOf(c.login_no)] : []))
  const [{ data: creds }, { data: locks }] = await Promise.all([
    guardianIds.length
      ? supabaseAdmin.from('guardian_credentials').select('guardian_id').in('guardian_id', guardianIds)
      : Promise.resolve({ data: [] as { guardian_id: string }[] }),
    loginNos.length
      ? supabaseAdmin.from('guardian_login_locks').select('login_no, locked_until, hard_locked').in('login_no', loginNos)
      : Promise.resolve({ data: [] as { login_no: string; locked_until: string | null; hard_locked: boolean }[] }),
  ])
  const migrated = new Set((creds ?? []).map((c) => c.guardian_id))
  const lockOf = new Map((locks ?? []).map((l) => [l.login_no, l]))
  const now = new Date()

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
      pin_status: !c.guardian_id ? 'none' : migrated.has(c.guardian_id) ? 'new' : 'legacy',
      lock: (() => {
        const l = c.login_no ? lockOf.get(lockKeyOf(c.login_no)) : undefined
        if (!l) return null
        if (l.hard_locked) return 'hard'
        return l.locked_until && new Date(l.locked_until) > now ? 'temp' : null
      })(),
    }]
  })

  return NextResponse.json<ChildrenListResponse>({ children, legacy_until: LEGACY_PIN_LOGIN_UNTIL })
}