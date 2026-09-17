/* app/api/admin/attendance/route.ts
 *
 * 栄養士向け。指定日の食数と欠席者を返す。
 * 区分ごとに「何を除いた食事が何食いるか」まで出す。
 * 園全体で除いている食材は、設定により食数から外せる。
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

const labelOf = (key: string) =>
  STANDARD_ALLERGENS.find((a) => a.key === key)?.label ?? key

export async function GET(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const url = new URL(req.url)
  const date = url.searchParams.get('date') || todayStr()

  /* 園の設定 */
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('attendance_deadline, allergy_label_format, show_allergy_in_counts, common_free_allergens')
    .eq('id', staff.school_id)
    .maybeSingle()

  const labelFormat = school?.allergy_label_format ?? '{name}除去'
  const showInCounts = school?.show_allergy_in_counts !== false
  const commonFree: Record<string, boolean> = school?.common_free_allergens ?? {}

  /* 在籍している園児 */
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, login_no, name, class_name, allergens')
    .eq('school_id', staff.school_id)
    .eq('is_active', true)
    .order('login_no')

  const kids = children ?? []
  const emptyResult = {
    date, mealTypes: [], counts: [], total: 0, enrolled: 0,
    absent: [], late: [], noReport: [], allergyCounts: [],
    allergyChildren: [], feverCount: 0,
    deadline: school?.attendance_deadline?.slice(0, 5) ?? '09:00',
    labelFormat, showInCounts, commonFree,
  }
  if (kids.length === 0) return NextResponse.json(emptyResult)

  const ids = kids.map((c) => c.id)

  const { data: mealTypes } = await supabaseAdmin
    .from('meal_types')
    .select('*')
    .eq('school_id', staff.school_id)
    .eq('is_active', true)
    .order('sort_order')

  const { data: history } = await supabaseAdmin
    .from('child_meal_types')
    .select('child_id, meal_type_id, start_date')
    .in('child_id', ids)

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

  /* 園全体で除いていない食材だけを、その子の「除去」として扱う */
  const individualAllergens = (allergens: any): string[] =>
    STANDARD_ALLERGENS
      .filter((a) => allergens?.[a.key] === true && commonFree[a.key] !== true)
      .map((a) => a.key)

  /* 集計 */
  const counts = new Map<string, number>()
  /* 区分ID -> 「卵,乳」のような組み合わせ -> 食数 */
  const freeByType = new Map<string, Map<string, number>>()
  const absent: any[] = []
  const late: any[] = []
  const noReport: any[] = []
  const allergyCount = new Map<string, number>()
  const allergyChildren: any[] = []
  let feverCount = 0
  let total = 0

  const nameOfType = new Map((mealTypes ?? []).map((m) => [m.id, m.name]))

  kids.forEach((c) => {
    const a = att.get(c.id)
    const mealTypeId = activeMealType(byChild.get(c.id) ?? [], date)
    const mine = individualAllergens(c.allergens)
    const allMine = STANDARD_ALLERGENS
      .filter((al) => c.allergens?.[al.key] === true)
      .map((al) => ({ key: al.key, label: al.label, emoji: al.emoji }))

    const base = {
      id: c.id, name: c.name, class_name: c.class_name,
      meal_type_id: mealTypeId,
      meal_type_name: mealTypeId ? nameOfType.get(mealTypeId) ?? null : null,
      allergens: allMine,
    }

    if (!a) noReport.push(base)

    if (a?.status === 'absent') {
      absent.push({
        ...base,
        reason_type: a.reason_type, reason: a.reason,
        temperature: a.temperature, symptoms: a.symptoms,
        created_at: a.created_at,
      })
      if (hasFever(a.temperature)) feverCount++
      return
    }

    if (a?.status === 'late') {
      late.push({
        ...base,
        arrival_time: a.arrival_time, needs_lunch: a.needs_lunch,
        reason_type: a.reason_type, reason: a.reason,
        temperature: a.temperature,
      })
      if (hasFever(a.temperature)) feverCount++
      if (!a.needs_lunch) return
    }

    /* ここまで来たら給食を食べる */
    total++
    const typeKey = mealTypeId ?? '__unset'
    counts.set(typeKey, (counts.get(typeKey) ?? 0) + 1)

    /* 個別に除去が必要な子 */
    if (mine.length > 0) {
      const combo = mine.join(',')
      const map = freeByType.get(typeKey) ?? new Map<string, number>()
      map.set(combo, (map.get(combo) ?? 0) + 1)
      freeByType.set(typeKey, map)

      mine.forEach((k) => allergyCount.set(k, (allergyCount.get(k) ?? 0) + 1))
      allergyChildren.push(base)
    }
  })

  /* 区分ごとの食数に、除去の内訳を添える */
  const buildFree = (typeKey: string) => {
    if (!showInCounts) return []
    const map = freeByType.get(typeKey)
    if (!map) return []
    return [...map.entries()]
      .map(([combo, count]) => ({
        keys: combo.split(','),
        label: labelFormat.replace(
          '{name}',
          combo.split(',').map(labelOf).join('・')
        ),
        count,
      }))
      .sort((a, b) => b.count - a.count)
  }

  const countList = (mealTypes ?? []).map((m) => ({
    id: m.id, name: m.name, is_baby: m.is_baby,
    count: counts.get(m.id) ?? 0,
    free: buildFree(m.id),
  }))

  const unset = counts.get('__unset') ?? 0
  if (unset > 0) {
    countList.push({
      id: '__unset', name: '区分が未設定', is_baby: false,
      count: unset, free: buildFree('__unset'),
    })
  }

  const allergyCounts = STANDARD_ALLERGENS
    .filter((a) => (allergyCount.get(a.key) ?? 0) > 0)
    .map((a) => ({
      key: a.key, label: a.label, emoji: a.emoji,
      count: allergyCount.get(a.key)!,
    }))

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
    allergyChildren,
    feverCount,
    deadline: school?.attendance_deadline?.slice(0, 5) ?? '09:00',
    labelFormat,
    showInCounts,
    commonFree,
  })
}