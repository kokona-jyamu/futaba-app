/* app/api/attendance/route.ts
 *
 * 保護者からの出欠連絡。
 * 書き込みは必ずここを通す（RLS では insert を許可していない）。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { dateRange, todayStr, type AttendanceStatus } from '@/lib/attendance'

const VALID_STATUS: AttendanceStatus[] = ['present', 'late', 'absent']
const MAX_DAYS = 31

async function requireGuardian() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: guardian } = await supabaseAdmin
    .from('guardians')
    .select('id, child_id, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!guardian) {
    throw NextResponse.json({ error: '保護者アカウントではありません' }, { status: 403 })
  }

  return guardian
}

/* ================================================================
   GET: 自分の子の出欠を取る
   ?from=YYYY-MM-DD&to=YYYY-MM-DD（省略時は今月）
   ================================================================ */
export async function GET(req: Request) {
  let guardian
  try {
    guardian = await requireGuardian()
  } catch (res) {
    return res as NextResponse
  }

  const url = new URL(req.url)
  const now = new Date()
  const from = url.searchParams.get('from')
    ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to = url.searchParams.get('to')
    ?? `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`

  const { data, error } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('child_id', guardian.child_id)
    .gte('target_date', from)
    .lte('target_date', to)
    .order('target_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  /* 締め切り時刻も一緒に返す */
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('attendance_deadline')
    .eq('id', guardian.school_id)
    .maybeSingle()

  return NextResponse.json({
    attendances: data ?? [],
    deadline: school?.attendance_deadline?.slice(0, 5) ?? '09:00',
  })
}

/* ================================================================
   POST: 出欠を登録する（単日・複数日どちらも）
   body: {
     dates: string[],      // 対象日
     status, arrival_time, needs_lunch,
     reason_type, reason, temperature, symptoms
   }
   ================================================================ */
export async function POST(req: Request) {
  let guardian
  try {
    guardian = await requireGuardian()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)

  /* 日付の受け取り。dates か from/to のどちらでもよい */
  let dates: string[] = Array.isArray(body?.dates) ? body.dates : []
  if (dates.length === 0 && body?.from && body?.to) {
    dates = dateRange(String(body.from), String(body.to))
  }
  dates = dates
    .map((d) => String(d))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))

  if (dates.length === 0) {
    return NextResponse.json({ error: '日付が選ばれていません' }, { status: 400 })
  }
  if (dates.length > MAX_DAYS) {
    return NextResponse.json(
      { error: `一度に登録できるのは${MAX_DAYS}日までです` },
      { status: 400 }
    )
  }

  const status = String(body?.status ?? '')
  if (!VALID_STATUS.includes(status as AttendanceStatus)) {
    return NextResponse.json({ error: '出欠の区分が不正です' }, { status: 400 })
  }

  /* 過去の日付は変更させない（当日は可） */
  const today = todayStr()
  if (dates.some((d) => d < today)) {
    return NextResponse.json(
      { error: '過ぎた日の連絡は変更できません。園にご連絡ください。' },
      { status: 400 }
    )
  }

  const temperature =
    body?.temperature === '' || body?.temperature == null
      ? null
      : Number.parseFloat(String(body.temperature))

  if (temperature !== null && (Number.isNaN(temperature) || temperature < 33 || temperature > 43)) {
    return NextResponse.json({ error: '体温の値をご確認ください' }, { status: 400 })
  }

  const rows = dates.map((target_date) => ({
    child_id: guardian.child_id,
    school_id: guardian.school_id,
    target_date,
    status,
    arrival_time: status === 'late' ? (body?.arrival_time || null) : null,
    needs_lunch: status === 'absent' ? false : body?.needs_lunch !== false,
    reason_type: status === 'present' ? null : (body?.reason_type || null),
    reason: status === 'present' ? null : (body?.reason || null),
    temperature: status === 'present' ? null : temperature,
    symptoms: status === 'present' ? null : (body?.symptoms || null),
    reported_by: guardian.id,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('attendances')
    .upsert(rows, { onConflict: 'child_id,target_date' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ attendances: data ?? [], count: rows.length })
}

/* ================================================================
   DELETE: 連絡を取り消す（出席に戻す）
   body: { dates: string[] }
   ================================================================ */
export async function DELETE(req: Request) {
  let guardian
  try {
    guardian = await requireGuardian()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const dates: string[] = Array.isArray(body?.dates) ? body.dates.map(String) : []

  if (dates.length === 0) {
    return NextResponse.json({ error: '日付が選ばれていません' }, { status: 400 })
  }

  const today = todayStr()
  if (dates.some((d) => d < today)) {
    return NextResponse.json(
      { error: '過ぎた日の連絡は変更できません。' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('attendances')
    .delete()
    .eq('child_id', guardian.child_id)
    .in('target_date', dates)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}