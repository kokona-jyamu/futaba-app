/* lib/dishes.ts — 料理と「献立の料理」の読み書き（サーバー専用）
 *
 * dishes / menu_dishes はブラウザから読めないようにしているため、
 * 管理画面の API と、保護者向けのサーバー側の処理からここを使う。
 */

import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { toRecipe, hasRecipe } from '@/lib/recipes'
import type { DishSummary, MenuDish } from '@/lib/apiTypes'

/** menus の select に足す、入っている料理の列（献立と一緒に1回で読む） */
export const MENU_DISHES_SELECT =
  'menu_dishes(id, dish_id, photo_url, sort_order, dishes(id, kind_id, name))'

/** select で読んだ menu_dishes を、画面に返す形（MenuDish）にする */
export const toMenuDishes = (
  rows: {
    id: string
    dish_id: string
    photo_url: string | null
    sort_order: number
    dishes: { id: string; kind_id: string; name: string } | null
  }[] | null | undefined
): MenuDish[] =>
  (rows ?? []).flatMap((r) =>
    r.dishes
      ? [{ id: r.id, dish_id: r.dish_id, photo_url: r.photo_url, sort_order: r.sort_order, dish: r.dishes }]
      : []
  )

/** 園の料理のID（受け取った料理の検証に使う） */
export async function dishIdsOf(schoolId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin.from('dishes').select('id').eq('school_id', schoolId)
  return new Set((data ?? []).map((d) => d.id))
}

/** 園の料理の一覧。前回の写真・最後に出した日・出した回数・レシピの有無を添える */
export async function getDishSummaries(schoolId: string): Promise<DishSummary[]> {
  const [{ data: dishes }, { data: uses }] = await Promise.all([
    supabaseAdmin
      .from('dishes')
      .select('id, kind_id, name, recipe_servings, recipe_ingredients, recipe_steps, recipe_tip')
      .eq('school_id', schoolId)
      .order('name'),
    supabaseAdmin
      .from('menu_dishes')
      .select('dish_id, photo_url, menus!inner(served_date, school_id)')
      .eq('menus.school_id', schoolId),
  ])

  /* 料理ごとに、出した回数・最後に出した日・最後の写真をまとめる */
  const stats = new Map<string, { times: number; lastDate: string | null; lastPhoto: string | null; lastPhotoDate: string }>()
  for (const u of uses ?? []) {
    const date = u.menus?.served_date ?? ''
    const s = stats.get(u.dish_id) ?? { times: 0, lastDate: null, lastPhoto: null, lastPhotoDate: '' }
    s.times++
    if (!s.lastDate || date > s.lastDate) s.lastDate = date
    if (u.photo_url && date >= s.lastPhotoDate) { s.lastPhoto = u.photo_url; s.lastPhotoDate = date }
    stats.set(u.dish_id, s)
  }

  return (dishes ?? []).map((d) => {
    const s = stats.get(d.id)
    return {
      id: d.id,
      kind_id: d.kind_id,
      name: d.name,
      has_recipe: hasRecipe(toRecipe(d)),
      last_photo_url: s?.lastPhoto ?? null,
      last_served_date: s?.lastDate ?? null,
      times_served: s?.times ?? 0,
    }
  })
}

/**
 * その日の献立に入っている料理を、渡した内容に入れ替える。
 * 先に追加・更新し、そのあと外した料理を消す（途中で失敗しても料理が全部消えないように）。
 */
export async function replaceMenuDishes(
  menuId: string,
  dishes: { dish_id: string; photo_url: string | null; sort_order: number }[]
): Promise<string | null> {
  if (dishes.length > 0) {
    const { error } = await supabaseAdmin
      .from('menu_dishes')
      .upsert(dishes.map((d) => ({ ...d, menu_id: menuId })), { onConflict: 'menu_id,dish_id' })
    if (error) return error.message
  }

  let remove = supabaseAdmin.from('menu_dishes').delete().eq('menu_id', menuId)
  if (dishes.length > 0) {
    remove = remove.not('dish_id', 'in', `(${dishes.map((d) => d.dish_id).join(',')})`)
  }
  const { error } = await remove
  return error?.message ?? null
}
