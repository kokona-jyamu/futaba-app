/* app/api/admin/settings/route.ts
 *
 * 園ごとの設定。アレルギー表示の呼び方と、食数への出し方を持つ。
 */

import { NextResponse } from 'next/server'
import type { TablesUpdate } from '@/lib/database.types'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sanitizeAllergens, toAllergenMap } from '@/lib/allergens'
import type { SettingsResponse } from '@/lib/apiTypes'

export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const { data, error } = await supabaseAdmin
    .from('schools')
    .select('id, name, attendance_deadline, allergy_label_format, show_allergy_in_counts, common_free_allergens')
    .eq('id', staff.school_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: '園の情報が見つかりません' }, { status: 404 })

  /* 在籍している子のアレルギーをまとめる（献立を組むときの参考に） */
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, name, class_name, allergens')
    .eq('school_id', staff.school_id)
    .eq('is_active', true)

  const inUse = new Map<string, { name: string; class_name: string | null }[]>()
  ;(children ?? []).forEach((c) => {
    Object.entries(toAllergenMap(c.allergens)).forEach(([key, on]) => {
      if (on !== true) return
      const list = inUse.get(key) ?? []
      list.push({ name: c.name, class_name: c.class_name })
      inUse.set(key, list)
    })
  })

  return NextResponse.json<SettingsResponse>({
    settings: {
      ...data,
      attendance_deadline: data.attendance_deadline?.slice(0, 5) ?? '09:00',
      common_free_allergens: toAllergenMap(data.common_free_allergens),
    },
    enrolledAllergens: [...inUse.entries()].map(([key, kids]) => ({
      key, count: kids.length, children: kids,
    })),
  })
}

export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body = await req.json().catch(() => null)
  const patch: TablesUpdate<'schools'> = {}

  if (body?.attendance_deadline !== undefined) {
    patch.attendance_deadline = String(body.attendance_deadline)
  }
  if (body?.allergy_label_format !== undefined) {
    const fmt = String(body.allergy_label_format).trim()
    if (!fmt.includes('{name}')) {
      return NextResponse.json(
        { error: '呼び方には {name} を含めてください' },
        { status: 400 }
      )
    }
    patch.allergy_label_format = fmt
  }
  if (body?.show_allergy_in_counts !== undefined) {
    patch.show_allergy_in_counts = body.show_allergy_in_counts === true
  }
  if (body?.common_free_allergens !== undefined) {
    const parsed = sanitizeAllergens(body.common_free_allergens ?? {})
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    patch.common_free_allergens = parsed.allergens
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '変更がありません' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('schools')
    .update(patch)
    .eq('id', staff.school_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ settings: data })
}