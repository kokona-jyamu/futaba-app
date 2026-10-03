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
import { noToEmail, pinToPassword, generatePin, isValidPin } from '@/lib/guardian'

/* ================================================================
   POST: 園児を登録し、保護者アカウントを発行する
   body: { login_no, name, class_name?, pin? }
   返る pin は「この1回だけ」表示できる。DBに平文では残らない。
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

  const pin = body?.pin ? String(body.pin).trim() : generatePin()
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: 'PINは4桁の数字にしてください' }, { status: 400 })
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
    password: pinToPassword(login_no, pin),
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

  return NextResponse.json({ child, pin })
}

/* ================================================================
   PATCH: PINを再発行する
   body: { child_id, pin? }
   ================================================================ */
export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body = await req.json().catch(() => null)
  const child_id = String(body?.child_id ?? '')
  if (!child_id) {
    return NextResponse.json({ error: 'child_id が必要です' }, { status: 400 })
  }

  const pin = body?.pin ? String(body.pin).trim() : generatePin()
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: 'PINは4桁の数字にしてください' }, { status: 400 })
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

  const { error } = await supabaseAdmin.auth.admin.updateUserById(guardian.id, {
    password: pinToPassword(child.login_no, pin),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ pin })
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
    .from('children').select('id')
    .eq('id', child_id).eq('school_id', staff.school_id).maybeSingle()

  if (!child) {
    return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })
  }

  const { data: guardian } = await supabaseAdmin
    .from('guardians').select('id').eq('child_id', child_id).maybeSingle()

  if (guardian) await supabaseAdmin.auth.admin.deleteUser(guardian.id)
  await supabaseAdmin.from('children').delete().eq('id', child_id)

  return NextResponse.json({ ok: true })
}