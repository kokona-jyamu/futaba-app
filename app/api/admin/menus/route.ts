/* app/api/admin/menus/route.ts
 *
 * 献立の作成・更新・削除。
 * RLS を掛けた後は、職員の書き込みはすべてここを通す。
 *
 * 写真：お盆全体は menus.tray_photo_url、料理ごとの写真は menu_dishes（その日の写真）に持つ。
 * body.dishes … [{ dish_id, photo_url }]（並び順どおり）。その日の料理をこの内容に入れ替える。
 */

import { NextResponse } from 'next/server'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sanitizeAllergens } from '@/lib/allergens'
import { isDateStr } from '@/lib/date'
import { str, strList, numOrNull, type Body } from '@/lib/parse'
import { checkPhotoUrl, sanitizeMenuDishes } from '@/lib/menuPhotos'
import { dishIdsOf, replaceMenuDishes, toMenuDishes, MENU_DISHES_SELECT } from '@/lib/dishes'
import type { AdminMenu } from '@/lib/apiTypes'

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
  const tray = checkPhotoUrl(body.tray_photo_url)
  if (!tray.ok) return { ok: false, error: 'お盆全体の写真の指定が不正です' }

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
      tray_photo_url: tray.url,
      is_published: body.is_published !== false,
    },
  }
}

/** 入っている料理も含めて、献立を1件読み直す（画面に返す形） */
async function readAdminMenu(id: string, schoolId: string): Promise<AdminMenu | null> {
  const { data } = await supabaseAdmin
    .from('menus')
    .select(`*, ${MENU_DISHES_SELECT}`)
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle()
  return data ? { ...data, menu_dishes: toMenuDishes(data.menu_dishes) } : null
}

/** body.dishes があれば検証して、その日の料理を入れ替える。エラーなら文言を返す */
async function saveDishes(menuId: string, body: Body, schoolId: string): Promise<string | null> {
  if (body.dishes === undefined) return null
  const parsed = sanitizeMenuDishes(body.dishes, await dishIdsOf(schoolId))
  if (!parsed.ok) return parsed.error
  return replaceMenuDishes(menuId, parsed.dishes)
}

/* ================================================================
   POST: 献立を作る
   ================================================================ */
export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const picked = pickMenuFields(body)
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 })

  /* 料理の指定が正しいかは、献立を作る前に確かめる */
  if (body.dishes !== undefined) {
    const parsed = sanitizeMenuDishes(body.dishes, await dishIdsOf(staff.school_id))
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('menus')
    .insert({ ...picked.fields, school_id: staff.school_id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const dishError = await saveDishes(data.id, body, staff.school_id)
  if (dishError) {
    return NextResponse.json(
      { error: '献立は保存しましたが、料理を保存できませんでした：' + dishError },
      { status: 400 }
    )
  }

  return NextResponse.json({ menu: await readAdminMenu(data.id, staff.school_id) })
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

  /* 公開だけ、あるいはコメントと写真・料理だけを更新する場合 */
  if (body.partial === true) {
    const patch: TablesUpdate<'menus'> = {}
    if (body.nutritionist_comment !== undefined) patch.nutritionist_comment = str(body.nutritionist_comment)
    if (body.why_eat_note !== undefined) patch.why_eat_note = str(body.why_eat_note)
    if (body.tray_photo_url !== undefined) {
      const tray = checkPhotoUrl(body.tray_photo_url)
      if (!tray.ok) return NextResponse.json({ error: 'お盆全体の写真の指定が不正です' }, { status: 400 })
      patch.tray_photo_url = tray.url
    }
    if (body.is_published !== undefined) patch.is_published = body.is_published === true

    const { data, error } = await supabaseAdmin
      .from('menus')
      .update(patch)
      .eq('id', id)
      .eq('school_id', staff.school_id)
      .select('id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })

    const dishError = await saveDishes(id, body, staff.school_id)
    if (dishError) return NextResponse.json({ error: dishError }, { status: 400 })

    return NextResponse.json({ menu: await readAdminMenu(id, staff.school_id) })
  }

  const picked = pickMenuFields(body)
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 })

  /* 他園の献立を触れないよう school_id で絞る */
  const { data, error } = await supabaseAdmin
    .from('menus')
    .update(picked.fields)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })

  const dishError = await saveDishes(id, body, staff.school_id)
  if (dishError) return NextResponse.json({ error: dishError }, { status: 400 })

  return NextResponse.json({ menu: await readAdminMenu(id, staff.school_id) })
}

/* ================================================================
   DELETE: 献立を消す（その日の料理も消える。料理とレシピは残る）
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
