/* app/api/admin/menus/bulk/route.ts
 *
 * 月間献立の一括登録。すべて下書き（is_published = false）として保存する。
 * アレルゲンが未記入の行は登録しない（安全のため）。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'

const STAFF_ROLES = ['nutritionist', 'admin']
const MAX_ROWS = 60

async function requireStaff() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    throw NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  return profile
}

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
}

export async function POST(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const rows: Row[] = Array.isArray(body?.rows) ? body.rows : []

  if (rows.length === 0) {
    return NextResponse.json({ error: '登録するデータがありません' }, { status: 400 })
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `一度に登録できるのは${MAX_ROWS}件までです` },
      { status: 400 }
    )
  }

  /* 同じ日付の献立がすでにあるか調べる */
  const dates = rows.map((r) => r.served_date)
  const { data: existing } = await supabaseAdmin
    .from('menus')
    .select('served_date')
    .eq('school_id', staff.school_id)
    .in('served_date', dates)

  const taken = new Set((existing ?? []).map((e) => e.served_date))

  const toInsert = rows
    .filter((r) => !taken.has(r.served_date))
    .map((r) => ({
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
      photo_url: null,
    }))

  if (toInsert.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skipped: rows.length,
      skippedDates: [...taken],
    })
  }

  const { data, error } = await supabaseAdmin
    .from('menus')
    .insert(toInsert)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    inserted: data?.length ?? 0,
    skipped: taken.size,
    skippedDates: [...taken],
    menus: data ?? [],
  })
}