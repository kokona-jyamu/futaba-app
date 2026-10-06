/* app/api/admin/dishes/[id]/route.ts
 *
 * 料理1件とレシピ（管理画面のレシピの編集で使う）。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { toRecipe } from '@/lib/recipes'
import type { DishResponse } from '@/lib/apiTypes'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { id } = await params

  const { data } = await supabaseAdmin
    .from('dishes')
    .select('id, kind_id, name, recipe_servings, recipe_ingredients, recipe_steps, recipe_tip')
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: '対象の料理が見つかりません' }, { status: 404 })

  return NextResponse.json<DishResponse>({
    dish: { id: data.id, kind_id: data.kind_id, name: data.name, recipe: toRecipe(data) },
  })
}
