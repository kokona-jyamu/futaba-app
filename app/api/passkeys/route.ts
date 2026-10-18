/* app/api/passkeys/route.ts
 *
 * 保護者が生体認証に使っている端末の一覧と削除（自分の分だけ）。
 */

import { NextResponse } from 'next/server'
import { requireGuardian } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Body } from '@/lib/parse'
import type { PasskeysResponse } from '@/lib/apiTypes'

/* ================================================================
   GET: 登録した端末の一覧
   ================================================================ */
export async function GET() {
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const { data, error } = await supabaseAdmin
    .from('guardian_passkeys')
    .select('id, device_name, created_at, last_used_at')
    .eq('guardian_id', guardian.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json<PasskeysResponse>({ passkeys: data ?? [] })
}

/* ================================================================
   DELETE: 端末を外す（その端末では生体認証でログインできなくなる）
   body: { id }
   ================================================================ */
export async function DELETE(req: Request) {
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  /* 他の保護者の端末を消せないよう guardian_id で絞る */
  const { error } = await supabaseAdmin
    .from('guardian_passkeys')
    .delete()
    .eq('id', id)
    .eq('guardian_id', guardian.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
