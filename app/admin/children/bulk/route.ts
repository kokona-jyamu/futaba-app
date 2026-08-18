/* app/api/admin/children/bulk/route.ts
 *
 * 園児の一括登録。名簿を貼り付けて一度に発行する。
 * 1件ずつ処理し、失敗した行はスキップして結果を返す。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { noToEmail, pinToPassword, generatePin } from '@/lib/guardian'

const STAFF_ROLES = ['nutritionist', 'admin']
const MAX_ROWS = 300

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

type Row = { login_no: string; name: string; class_name: string | null }
type Result =
  | { ok: true; login_no: string; name: string; class_name: string | null; pin: string }
  | { ok: false; login_no: string; name: string; error: string }

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

  const results: Result[] = []

  for (const row of rows) {
    const login_no = String(row?.login_no ?? '').trim()
    const name = String(row?.name ?? '').trim()
    const class_name = row?.class_name ? String(row.class_name).trim() : null

    if (!login_no || !name) {
      results.push({ ok: false, login_no, name, error: '出席番号か名前が空です' })
      continue
    }

    const pin = generatePin()

    /* 1. 園児 */
    const { data: child, error: childErr } = await supabaseAdmin
      .from('children')
      .insert({ school_id: staff.school_id, login_no, name, class_name })
      .select()
      .single()

    if (childErr) {
      results.push({
        ok: false,
        login_no,
        name,
        error: childErr.code === '23505' ? '出席番号が重複しています' : childErr.message,
      })
      continue
    }

    /* 2. Auth ユーザー */
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: noToEmail(login_no),
      password: pinToPassword(login_no, pin),
      email_confirm: true,
      user_metadata: { login_no, child_name: name },
    })

    if (authErr || !created?.user) {
      await supabaseAdmin.from('children').delete().eq('id', child.id)
      results.push({
        ok: false,
        login_no,
        name,
        error: 'アカウント作成に失敗：' + (authErr?.message ?? '不明'),
      })
      continue
    }

    /* 3. guardians */
    const { error: gErr } = await supabaseAdmin.from('guardians').insert({
      id: created.user.id,
      child_id: child.id,
      school_id: staff.school_id,
      display_name: `${name}の保護者`,
    })

    if (gErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      await supabaseAdmin.from('children').delete().eq('id', child.id)
      results.push({ ok: false, login_no, name, error: gErr.message })
      continue
    }

    results.push({ ok: true, login_no, name, class_name, pin })
  }

  return NextResponse.json({
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  })
}