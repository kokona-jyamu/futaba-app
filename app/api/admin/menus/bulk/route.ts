/* app/api/admin/menus/bulk/route.ts
 *
 * 月間献立の一括登録。すべて下書き（is_published = false）として保存する。
 * アレルゲンが未記入の行は登録しない（安全のため）。
 * 料理（主食・主菜…）の列があれば、料理を登録して（同じ種類・同じ名前があればそれを使う）献立に付ける。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPhotoKinds } from '@/lib/photoKinds'
import { isDateStr } from '@/lib/date'
import { sanitizeAllergens } from '@/lib/allergens'
import { numOrNull, str, strList, type Body } from '@/lib/parse'
import type { MenusBulkResponse } from '@/lib/apiTypes'

const MAX_ROWS = 60
const MAX_DISHES_PER_DAY = 12
const NAME_MAX = 60

type Dish = { kind_id: string; name: string }

type Row = {
  served_date: string
  title: string
  ingredients: string[] | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carb: number | null
  salt: number | null
  calcium: number | null
  allergens: Record<string, boolean>
  dishes: Dish[]
}

const dishKey = (d: Dish) =>`${d.kind_id}\u0000${d.name}`

export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const rawRows: Body[] = Array.isArray(body.rows) ? body.rows : []

  if (rawRows.length === 0) {
    return NextResponse.json({ error: '登録するデータがありません' }, { status: 400 })
  }
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `一度に登録できるのは${MAX_ROWS}件までです` },
      { status: 400 }
    )
  }

  /* ---------------- 中身の確認 ---------------- */

  const kinds = await getPhotoKinds(staff.school_id)
  const kindIds = new Set(kinds.map((k) => k.id))

  const rows: Row[] = []
  for (const r of rawRows) {
    const served_date = str(r.served_date) ?? ''
    const title = (str(r.title) ?? '').trim()
    if (!isDateStr(served_date)) {
      return NextResponse.json({ error: `日付が正しくありません（${served_date}）` }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ error: `${served_date} の献立名がありません` }, { status: 400 })
    }

    const dishes: Dish[] = []
    for (const d of (Array.isArray(r.dishes) ? r.dishes : []) as Body[]) {
      const kind_id = String(d?.kind_id ?? '')
      const name = (str(d?.name) ?? '').trim().slice(0, NAME_MAX)
      if (!name) continue
      if (!kindIds.has(kind_id)) {
        return NextResponse.json({ error: '料理の種類が見つかりません' }, { status: 400 })
      }
      if (!dishes.some((x) => dishKey(x) === dishKey({ kind_id, name }))) dishes.push({ kind_id, name })
    }
    if (dishes.length > MAX_DISHES_PER_DAY) {
      return NextResponse.json(
        { error: `${served_date} の料理が多すぎます（1日${MAX_DISHES_PER_DAY}品まで）` },
        { status: 400 }
      )
    }

    const allergens = sanitizeAllergens(r.allergens)
    if (!allergens.ok) {
      return NextResponse.json({ error: `${served_date}：${allergens.error}` }, { status: 400 })
    }

    rows.push({
      served_date,
      title,
      ingredients: strList(r.ingredients),
      kcal: numOrNull(r.kcal),
      protein: numOrNull(r.protein),
      fat: numOrNull(r.fat),
      carb: numOrNull(r.carb),
      salt: numOrNull(r.salt),
      calcium: numOrNull(r.calcium),
      allergens: allergens.allergens,
      dishes,
    })
  }

  /* 同じ日付が2回出てきたら、先のものだけ使う */
  const uniqueRows = rows.filter((r, i) => rows.findIndex((x) => x.served_date === r.served_date) === i)

  /* ---------------- すでに献立がある日は飛ばす ---------------- */

  const { data: existing } = await supabaseAdmin
    .from('menus')
    .select('served_date')
    .eq('school_id', staff.school_id)
    .in('served_date', uniqueRows.map((r) => r.served_date))

  const taken = new Set((existing ?? []).map((e) => e.served_date))
  const targets = uniqueRows.filter((r) => !taken.has(r.served_date))

  if (targets.length === 0) {
    return NextResponse.json<MenusBulkResponse>({
      inserted: 0,
      skippedDates: [...taken],
      newDishes: 0,
    })
  }

  /* ---------------- 料理を用意する（同じ種類・同じ名前があればそれを使う） ---------------- */

  const allDishes = targets.flatMap((r) => r.dishes)
  const wanted = [...new Map(allDishes.map((d) => [dishKey(d), d])).values()]
  const dishIdOf = new Map<string, string>()
  let newDishes = 0

  if (wanted.length > 0) {
    const names = [...new Set(wanted.map((d) => d.name))]
    const findDishes = async () => {
      const { data, error } = await supabaseAdmin
        .from('dishes')
        .select('id, kind_id, name')
        .eq('school_id', staff.school_id)
        .in('name', names)
      if (error) throw error
      return data ?? []
    }

    const before = await findDishes().catch(() => null)
    if (!before) return NextResponse.json({ error: '料理の確認に失敗しました' }, { status: 500 })
    before.forEach((d) => dishIdOf.set(dishKey(d), d.id))

    const missing = wanted.filter((d) => !dishIdOf.has(dishKey(d)))
    if (missing.length > 0) {
      /* 同時に同じ料理が登録された場合も重複しないよう、重複は無視して入れてから取り直す */
      const { error } = await supabaseAdmin
        .from('dishes')
        .upsert(
          missing.map((d) => ({ school_id: staff.school_id, kind_id: d.kind_id, name: d.name })),
          { onConflict: 'school_id,kind_id,name', ignoreDuplicates: true }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      const after = await findDishes().catch(() => null)
      if (!after) return NextResponse.json({ error: '料理の確認に失敗しました' }, { status: 500 })
      after.forEach((d) => dishIdOf.set(dishKey(d), d.id))
      newDishes = missing.length
    }
  }

  /* ---------------- 献立を入れる ---------------- */

  const { data: inserted, error } = await supabaseAdmin
    .from('menus')
    .insert(
      targets.map((r) => ({
        school_id: staff.school_id,
        served_date: r.served_date,
        title: r.title,
        ingredients: r.ingredients,
        kcal: r.kcal,
        protein: r.protein,
        fat: r.fat,
        carb: r.carb,
        salt: r.salt,
        calcium: r.calcium,
        allergens: r.allergens,
        allergen_checked: true,
        is_published: false,
        nutritionist_comment: null,
        why_eat_note: null,
        tray_photo_url: null,
      }))
    )
    .select('id, served_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  /* ---------------- 献立に料理を付ける ---------------- */

  const menuIdOf = new Map((inserted ?? []).map((m) => [m.served_date, m.id]))
  const links = targets.flatMap((r) => {
    const menuId = menuIdOf.get(r.served_date)
    if (!menuId) return []
    return r.dishes.flatMap((d, i) => {
      const dishId = dishIdOf.get(dishKey(d))
      return dishId ? [{ menu_id: menuId, dish_id: dishId, photo_url: null, sort_order: i }] : []
    })
  })

  if (links.length > 0) {
    const { error: linkError } = await supabaseAdmin.from('menu_dishes').insert(links)
    if (linkError) {
      return NextResponse.json(
        {
          error: `献立は登録しましたが、料理を付けられませんでした（${linkError.message}）。「編集」から料理を付けてください。`,
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json<MenusBulkResponse>({
    inserted: inserted?.length ?? 0,
    skippedDates: [...taken],
    newDishes,
  })
}
