/* app/api/admin/menus/list/route.ts
 *
 * 管理画面用の献立一覧。
 * RLS で下書き（is_published = false）は保護者から見えないため、
 * 栄養士向けにはサーバー経由で取得する。
 * 入っている料理（menu_dishes）も一緒に返す。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { MENU_DISHES_SELECT, toMenuDishes } from '@/lib/dishes'
import type { MenusResponse } from '@/lib/apiTypes'

export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { data, error } = await supabaseAdmin
    .from('menus')
    .select(`*, ${MENU_DISHES_SELECT}`)
    .eq('school_id', staff.school_id)
    .order('served_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  /* 入っている料理も一緒に返す（料理名・タグでの検索や、一覧の写真に使う） */
  return NextResponse.json<MenusResponse>({
    menus: (data ?? []).map((m) => ({ ...m, menu_dishes: toMenuDishes(m.menu_dishes) })),
  })
}