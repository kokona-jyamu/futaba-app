/* app/api/admin/children/route.ts
 *
 * 園児の登録とアカウント発行。
 * secret キーを使うためサーバー側でのみ動く。
 *
 * 認可：Cookie のセッションから auth ユーザーを取得し、
 *       staff テーブルに載っている職員かどうかを確認する。
 *       共有シークレット方式は廃止した。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { noToEmail, pinToPassword, generatePin, isValidPin } from '@/lib/guardian'

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

/* ----------------------------------------------------------------
   ログイン中のユーザーが自園の職員かどうかを確認する。
   職員でなければ Response を投げるので、呼び出し側で catch する。
   ---------------------------------------------------------------- */
async function requireStaff() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  /* staff の確認は RLS を迂回して行う（本人以外の行も引けるようにするため） */
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id, school_id')
    .eq('id', user.id)
    .eq('school_id', SCHOOL_ID)
    .maybeSingle()

  if (!staff) {
    throw NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  return staff
}

/* ================================================================
   POST: 園児を登録し、保護者アカウントを発行する
   body: { login_no, name, class_name?, pin? }
   返る pin は「この1回だけ」表示できる。DBに平文では残らない。
   ================================================================ */
export async function POST(req: Request) {
  try {
    await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

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
    .insert({ school_id: SCHOOL_ID, login_no, name, class_name })
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
    school_id: SCHOOL_ID,
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
  try {
    await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const child_id = String(body?.child_id ?? '')
  if (!child_id) {
    return NextResponse.json({ error: 'child_id が必要です' }, { status: 400 })
  }

  const pin = body?.pin ? String(body.pin).trim() : generatePin()
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: 'PINは4桁の数字にしてください' }, { status: 400 })
  }

  const { data: child } = await supabaseAdmin
    .from('children').select('id, login_no').eq('id', child_id).single()
  const { data: guardian } = await supabaseAdmin
    .from('guardians').select('id').eq('child_id', child_id).single()

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
  try {
    await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const child_id = String(body?.child_id ?? '')
  if (!child_id) {
    return NextResponse.json({ error: 'child_id が必要です' }, { status: 400 })
  }

  const { data: guardian } = await supabaseAdmin
    .from('guardians').select('id').eq('child_id', child_id).single()

  if (guardian) await supabaseAdmin.auth.admin.deleteUser(guardian.id)
  await supabaseAdmin.from('children').delete().eq('id', child_id)

  return NextResponse.json({ ok: true })
}