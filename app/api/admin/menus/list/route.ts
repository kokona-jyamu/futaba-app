/* app/api/admin/menus/list/route.ts
 *
 * 管理画面用の献立一覧。
 * RLS で下書き（is_published = false）は保護者から見えないため、
 * 栄養士向けにはサーバー経由で取得する。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { MenusResponse } from '@/lib/apiTypes'

export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { data, error } = await supabaseAdmin
    .from('menus')
    .select('*')
    .eq('school_id', staff.school_id)
    .order('served_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json<MenusResponse>({ menus: data ?? [] })
}