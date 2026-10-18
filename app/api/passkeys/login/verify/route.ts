/* app/api/passkeys/login/verify/route.ts
 *
 * 生体認証でのログインの確認。端末の署名を、登録済みの公開鍵で確かめる。
 * 正しければ、PIN のときと同じ方法でログイン状態を作る。
 * PIN のロック中でも使える（ロックは PIN を推測されそうなときの守りで、本人の端末は止めない）。
 * body: { response: 端末からの応答 }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createGuardianSession } from '@/lib/guardianSession'
import { RP_ID, ORIGIN, CHALLENGE_COOKIE, takeChallenge } from '@/lib/webauthn'
import type { Body } from '@/lib/parse'

const FAILED = '指紋・顔認証でログインできませんでした。PINでログインしてください。'

export async function POST(req: NextRequest) {
  const body: Body = (await req.json().catch(() => null)) ?? {}
  const response = body.response as AuthenticationResponseJSON | undefined

  const challenge = await takeChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value, 'login', null)
  if (!challenge || !response?.id) {
    return NextResponse.json({ error: '時間が過ぎました。もう一度お試しください。' }, { status: 400 })
  }

  /* 端末が選んだ鍵から、どの保護者かを探す */
  const { data: passkey } = await supabaseAdmin
    .from('guardian_passkeys')
    .select('id, guardian_id, credential_id, public_key, counter, transports')
    .eq('credential_id', response.id)
    .maybeSingle()

  if (!passkey) {
    return NextResponse.json(
      { error: 'この端末の指紋・顔認証は登録されていないか、解除されています。PINでログインしてください。' },
      { status: 401 }
    )
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(Buffer.from(passkey.public_key, 'base64url')),
        counter: Number(passkey.counter),
        transports: passkey.transports ?? undefined,
      },
      requireUserVerification: true,
    })
  } catch {
    return NextResponse.json({ error: FAILED }, { status: 401 })
  }
  if (!verification.verified) return NextResponse.json({ error: FAILED }, { status: 401 })

  /* 在籍中の園児の保護者であることを確かめる */
  const { data: guardian } = await supabaseAdmin
    .from('guardians')
    .select('id, children(login_no, is_active)')
    .eq('id', passkey.guardian_id)
    .maybeSingle()

  const child = guardian?.children
  if (!child || !child.is_active) return NextResponse.json({ error: FAILED }, { status: 401 })

  await supabaseAdmin
    .from('guardian_passkeys')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', passkey.id)

  const sessionError = await createGuardianSession(child.login_no)
  if (sessionError) {
    console.error('ログイン状態を作れませんでした', sessionError)
    return NextResponse.json({ error: 'ログインできませんでした。時間をおいてお試しください。' }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete(CHALLENGE_COOKIE)
  return res
}
