/* app/api/admin/children/list/route.ts
 *
 * 園児一覧の取得。children には RLS が掛かっていて
 * 職員からは読めないため、サーバー経由で取得する。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'

const STAFF_ROLES = ['nutritionist', 'admin']

export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('children_with_account')
    .select('*')
    .eq('school_id', profile.school_id)
    .order('class_name', { ascending: true })
    .order('login_no', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ children: data ?? [] })
}