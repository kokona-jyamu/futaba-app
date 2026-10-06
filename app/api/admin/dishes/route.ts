/* app/api/admin/dishes/route.ts
 *
 * 園の料理（種類＝タグ・料理名・保護者向けのレシピ）の一覧・登録・変更。
 * 料理は献立をまたいで使い回す。レシピを直すと、その料理を使った日すべてに反映される。
 * 過去の献立から外れないよう、料理の削除はしない。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPhotoKinds } from '@/lib/photoKinds'
import { getDishSummaries } from '@/lib/dishes'
import { sanitizeRecipe, toRecipe } from '@/lib/recipes'
import { str, type Body } from '@/lib/parse'
import type { TablesUpdate } from '@/lib/database.types'
import type { DishesResponse, DishResponse } from '@/lib/apiTypes'

const NAME_MAX = 60
const DISH_COLUMNS = 'id, kind_id, name, recipe_servings, recipe_ingredients, recipe_steps, recipe_tip'

const checkName = (value: unknown): { ok: true; name: string } | { ok: false; error: string } => {
  const name = str(value)?.trim()
  if (!name) return { ok: false, error: '料理名を入力してください' }
  if (name.length > NAME_MAX) return { ok: false, error: `料理名は${NAME_MAX}文字までにしてください` }
  return { ok: true, name }
}

const duplicateMessage = 'その種類に同じ名前の料理があります。一覧から選んでください'

/* ================================================================
   GET: 料理の一覧（前回の写真・最後に出した日・レシピの有無つき）
   ================================================================ */
export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  return NextResponse.json<DishesResponse>({ dishes: await getDishSummaries(staff.school_id) })
}

/* ================================================================
   POST: 料理を登録する
   body: { kind_id, name, recipe? }
   ================================================================ */
export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const checked = checkName(body.name)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const kinds = await getPhotoKinds(staff.school_id)
  const kindId = String(body.kind_id ?? '')
  if (!kinds.some((k) => k.id === kindId)) {
    return NextResponse.json({ error: '料理の種類が見つかりません' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('dishes')
    .insert({
      school_id: staff.school_id,
      kind_id: kindId,
      name: checked.name,
      ...(body.recipe !== undefined ? sanitizeRecipe(body.recipe) : {}),
    })
    .select(DISH_COLUMNS)
    .single()

  if (error) {
    const msg = error.code === '23505' ? duplicateMessage : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json<DishResponse>({
    dish: { id: data.id, kind_id: data.kind_id, name: data.name, recipe: toRecipe(data) },
  })
}

/* ================================================================
   PATCH: 料理名・種類・レシピを変える
   body: { id, name?, kind_id?, recipe? }
   ================================================================ */
export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const patch: TablesUpdate<'dishes'> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) {
    const checked = checkName(body.name)
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
    patch.name = checked.name
  }

  if (body.kind_id !== undefined) {
    const kinds = await getPhotoKinds(staff.school_id)
    const kindId = String(body.kind_id)
    if (!kinds.some((k) => k.id === kindId)) {
      return NextResponse.json({ error: '料理の種類が見つかりません' }, { status: 400 })
    }
    patch.kind_id = kindId
  }

  if (body.recipe !== undefined) Object.assign(patch, sanitizeRecipe(body.recipe))

  /* 他園の料理を触れないよう school_id で絞る */
  const { data, error } = await supabaseAdmin
    .from('dishes')
    .update(patch)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select(DISH_COLUMNS)
    .maybeSingle()

  if (error) {
    const msg = error.code === '23505' ? duplicateMessage : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  if (!data) return NextResponse.json({ error: '対象の料理が見つかりません' }, { status: 404 })

  return NextResponse.json<DishResponse>({
    dish: { id: data.id, kind_id: data.kind_id, name: data.name, recipe: toRecipe(data) },
  })
}
