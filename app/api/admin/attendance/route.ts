/* app/api/admin/attendance/route.ts
 *
 * 栄養士向け。指定日の食数と欠席者を返す。
 * 区分ごとの人数、アレルギー除去の人数、発熱者の数までまとめて出す。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { todayStr, hasFever } from '@/lib/attendance'
import { STANDARD_ALLERGENS } from '@/lib/allergens'

const STAFF_ROLES = ['nutritionist', 'admin']

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

/** その日時点で有効な食事区分を求める */
function activeMealType(
  history: { meal_type_id: string; start_date: string }[],
  date: string
): string | null {
  const applied = history
    .filter((h) => h.start_date <= date)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
  return applied[0]?.meal_type_id ?? null
}

export async function GET(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const url = new URL(req.url)
  const date = url.searchParams.get('date') || todayStr()

  /* 在籍している園児 */
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, login_no, name, class_name, allergens')
    .eq('school_id', staff.school_id)
    .eq('is_active', true)
    .order('login_no')

  const kids = children ?? []
  if (kids.length === 0) {
    return NextResponse.json({
      date, mealTypes: [], counts: [], total: 0,
      absent: [], late: [], allergyCounts: [], feverCount: 0,
      noReport: [], deadline: '09:00',
    })
  }

  const ids = kids.map((c) => c.id)

  /* 食事区分マスタ */
  const { data: mealTypes } = await supabaseAdmin
    .from('meal_types')
    .select('*')
    .eq('school_id', staff.school_id)
    .eq('is_active', true)
    .order('sort_order')

  /* 区分の履歴 */
  const { data: history } = await supabaseAdmin
    .from('child_meal_types')
    .select('child_id, meal_type_id, start_date')
    .in('child_id', ids)

  /* その日の出欠 */
  const { data: attendances } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('school_id', staff.school_id)
    .eq('target_date', date)

  const att = new Map((attendances ?? []).map((a) => [a.child_id, a]))

  const byChild = new Map<string, { meal_type_id: string; start_date: string }[]>()
  ;(history ?? []).forEach((h) => {
    const list = byChild.get(h.child_id) ?? []
    list.push(h)
    byChild.set(h.child_id, list)
  })

  /* 集計 */
  const counts = new Map<string, number>()
  const absent: any[] = []
  const late: any[] = []
  const noReport: any[] = []
  const allergyCount = new Map<string, number>()
  let feverCount = 0
  let total = 0

  kids.forEach((c) => {
    const a = att.get(c.id)
    const mealTypeId = activeMealType(byChild.get(c.id) ?? [], date)

    if (!a) {
      /* 連絡がない＝出席とみなす */
      noReport.push({ id: c.id, name: c.name, class_name: c.class_name })
    }

    if (a?.status === 'absent') {
      absent.push({
        id: c.id, name: c.name, class_name: c.class_name,
        reason_type: a.reason_type, reason: a.reason,
        temperature: a.temperature, symptoms: a.symptoms,
        created_at: a.created_at,
      })
      if (hasFever(a.temperature)) feverCount++
      return
    }

    if (a?.status === 'late') {
      late.push({
        id: c.id, name: c.name, class_name: c.class_name,
        arrival_time: a.arrival_time, needs_lunch: a.needs_lunch,
        reason_type: a.reason_type, reason: a.reason,
        temperature: a.temperature,
      })
      if (hasFever(a.temperature)) feverCount++
      if (!a.needs_lunch) return
    }

    /* ここまで来たら給食を食べる */
    total++
    if (mealTypeId) counts.set(mealTypeId, (counts.get(mealTypeId) ?? 0) + 1)
    else counts.set('__unset', (counts.get('__unset') ?? 0) + 1)

    STANDARD_ALLERGENS.forEach((al) => {
      if (c.allergens?.[al.key] === true) {
        allergyCount.set(al.key, (allergyCount.get(al.key) ?? 0) + 1)
      }
    })
  })

  const countList = (mealTypes ?? []).map((m) => ({
    id: m.id, name: m.name, is_baby: m.is_baby,
    count: counts.get(m.id) ?? 0,
  }))
  const unset = counts.get('__unset') ?? 0
  if (unset > 0) {
    countList.push({ id: '__unset', name: '区分が未設定', is_baby: false, count: unset })
  }

  const allergyCounts = STANDARD_ALLERGENS
    .filter((a) => (allergyCount.get(a.key) ?? 0) > 0)
    .map((a) => ({ key: a.key, label: a.label, emoji: a.emoji, count: allergyCount.get(a.key)! }))

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('attendance_deadline')
    .eq('id', staff.school_id)
    .maybeSingle()

  return NextResponse.json({
    date,
    mealTypes: mealTypes ?? [],
    counts: countList,
    total,
    enrolled: kids.length,
    absent,
    late,
    noReport,
    allergyCounts,
    feverCount,
    deadline: school?.attendance_deadline?.slice(0, 5) ?? '09:00',
  })
}