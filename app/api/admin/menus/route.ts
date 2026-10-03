/* app/api/admin/menus/route.ts
 *
 * 献立の作成・更新・削除。
 * RLS を掛けた後は、職員の書き込みはすべてここを通す。
 */

import { NextResponse } from 'next/server'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sanitizeAllergens } from '@/lib/allergens'
import { isDateStr } from '@/lib/date'
import { str, strList, numOrNull, type Body } from '@/lib/parse'

/**
 * 受け取った値から、DBに入れてよい項目だけを取り出す。
 * 日付・献立名・アレルギーの確認が済んでいないものは受け付けない。
 */
function pickMenuFields(
  body: Body
): { ok: true; fields: Omit<TablesInsert<'menus'>, 'school_id'> } | { ok: false; error: string } {
  const served_date = body.served_date
  const title = str(body.title)
  if (!isDateStr(served_date) || !title) {
    return { ok: false, error: '日付と献立名は必須です' }
  }
  if (body.allergen_checked !== true) {
    return { ok: false, error: 'アレルギーの確認が済んでいません' }
  }
  const allergens = sanitizeAllergens(body.allergens ?? {})
  if (!allergens.ok) return { ok: false, error: allergens.error }

  return {
    ok: true,
    fields: {
      served_date,
      title,
      ingredients: strList(body.ingredients),
      nutritionist_comment: str(body.nutritionist_comment),
      why_eat_note: str(body.why_eat_note),
      kcal: numOrNull(body.kcal),
      carb: numOrNull(body.carb),
      protein: numOrNull(body.protein),
      fat: numOrNull(body.fat),
      salt: numOrNull(body.salt),
      calcium: numOrNull(body.calcium),
      allergens: allergens.allergens,
      allergen_checked: true,
      photo_url: str(body.photo_url),
      is_published: body.is_published !== false,
    },
  }
}

/* ================================================================
   POST: 献立を作る
   ================================================================ */
export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body | null = await req.json().catch(() => null)
  const picked = pickMenuFields(body ?? {})
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('menus')
    .insert({ ...picked.fields, school_id: staff.school_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ menu: data })
}

/* ================================================================
   PATCH: 献立を更新する
   ================================================================ */
export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  /* 公開だけ、あるいはコメントと写真だけを更新する場合 */
  if (body.partial === true) {
    const patch: TablesUpdate<'menus'> = {}
    if (body.nutritionist_comment !== undefined) patch.nutritionist_comment = str(body.nutritionist_comment)
    if (body.why_eat_note !== undefined) patch.why_eat_note = str(body.why_eat_note)
    if (body.photo_url !== undefined) patch.photo_url = str(body.photo_url)
    if (body.is_published !== undefined) patch.is_published = body.is_published === true

    const { data, error } = await supabaseAdmin
      .from('menus')
      .update(patch)
      .eq('id', id)
      .eq('school_id', staff.school_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ menu: data })
  }
  
  const picked = pickMenuFields(body)
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 })

  /* 他園の献立を触れないよう school_id で絞る */
  const { data, error } = await supabaseAdmin
    .from('menus')
    .update(picked.fields)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })

  return NextResponse.json({ menu: data })
}

/* ================================================================
   DELETE: 献立を消す
   ================================================================ */
export async function DELETE(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('menus')
    .delete()
    .eq('id', id)
    .eq('school_id', staff.school_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}