/* app/api/admin/children/route.ts
 *
 * 園児の登録と保護者アカウントの発行。
 * secret キーを使うためサーバー側でのみ動く。
 *
 * 認可：Cookie のセッションからユーザーを取得し、
 *       public.users の role が nutritionist / admin かを確認する。
 *       （管理画面のログインと同じ判定方法に揃えている）
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { noToEmail } from '@/lib/guardian'
import { issuePin, randomAuthPassword, clearLock } from '@/lib/pinAuth'

/* ================================================================
   POST: 園児を登録し、保護者アカウントを発行する
   body: { login_no, name, class_name? }
   PIN は6桁を自動で作る。返る pin は「この1回だけ」表示できる。DBに平文では残らない。
   ================================================================ */
export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body = await req.json().catch(() => null)
  const login_no = String(body?.login_no ?? '').trim()
  const name = String(body?.name ?? '').trim()
  const class_name = body?.class_name ? String(body.class_name).trim() : null

  if (!login_no || !name) {
    return NextResponse.json({ error: '出席番号と園児名は必須です' }, { status: 400 })
  }

  /* 1. 園児を登録 */
  const { data: child, error: childErr } = await supabaseAdmin
    .from('children')
    .insert({ school_id: staff.school_id, login_no, name, class_name })
    .select()
    .single()

  if (childErr) {
    const msg = childErr.code === '23505'
      ? `出席番号 ${login_no} はすでに使われています`
      : childErr.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  /* 2. Auth ユーザーを作成 */
  const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: noToEmail(login_no),
    /* パスワードは誰にも知らせないランダムな値（ログインは PIN をサーバーで確かめる） */
    password: randomAuthPassword(),
    email_confirm: true,
    user_metadata: { login_no, child_name: name },
  })

  if (authErr || !created?.user) {
    await supabaseAdmin.from('children').delete().eq('id', child.id)
    return NextResponse.json(
      { error: 'アカウント作成に失敗しました：' + (authErr?.message ?? '不明') },
      { status: 400 }
    )
  }

  /* 3. guardians に紐づける */
  const { error: gErr } = await supabaseAdmin.from('guardians').insert({
    id: created.user.id,
    child_id: child.id,
    school_id: staff.school_id,
    display_name: `${name}の保護者`,
  })

  if (gErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    await supabaseAdmin.from('children').delete().eq('id', child.id)
    return NextResponse.json({ error: gErr.message }, { status: 400 })
  }

  /* 4. PIN を発行する */
  const issued = await issuePin(created.user.id, login_no)
  if ('error' in issued) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    await supabaseAdmin.from('children').delete().eq('id', child.id)
    return NextResponse.json({ error: 'PINを発行できませんでした：' + issued.error }, { status: 400 })
  }

  return NextResponse.json({ child, pin: issued.pin })
}

/* ================================================================
   PATCH: PINを再発行する（6桁。ロックも解ける）
   body: { child_id }
   ================================================================ */
export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body = await req.json().catch(() => null)
  const child_id = String(body?.child_id ?? '')
  if (!child_id) {
    return NextResponse.json({ error: 'child_id が必要です' }, { status: 400 })
  }

  /* 他園の園児を操作できないよう school_id で絞る */
  const { data: child } = await supabaseAdmin
    .from('children').select('id, login_no')
    .eq('id', child_id).eq('school_id', staff.school_id).maybeSingle()
  const { data: guardian } = await supabaseAdmin
    .from('guardians').select('id').eq('child_id', child_id).maybeSingle()

  if (!child || !guardian) {
    return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })
  }

  const issued = await issuePin(guardian.id, child.login_no)
  if ('error' in issued) return NextResponse.json({ error: issued.error }, { status: 400 })

  return NextResponse.json({ pin: issued.pin })
}

/* ================================================================
   DELETE: 園児とアカウントをまとめて削除する
   body: { child_id }
   ================================================================ */
export async function DELETE(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body = await req.json().catch(() => null)
  const child_id = String(body?.child_id ?? '')
  if (!child_id) {
    return NextResponse.json({ error: 'child_id が必要です' }, { status: 400 })
  }

  const { data: child } = await supabaseAdmin
    .from('children').select('id, login_no')
    .eq('id', child_id).eq('school_id', staff.school_id).maybeSingle()

  if (!child) {
    return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })
  }

  const { data: guardian } = await supabaseAdmin
    .from('guardians').select('id').eq('child_id', child_id).maybeSingle()

  if (guardian) await supabaseAdmin.auth.admin.deleteUser(guardian.id)
  await supabaseAdmin.from('children').delete().eq('id', child_id)
  /* 同じ出席番号を次の園児に使ったときに、前のロックが残らないようにする */
  await clearLock(child.login_no)

  return NextResponse.json({ ok: true })
}