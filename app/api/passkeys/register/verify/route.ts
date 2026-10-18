/* app/api/passkeys/register/verify/route.ts
 *
 * 生体認証の登録の確認。端末が作った鍵の情報を確かめ、公開鍵を保存する。
 * body: { response: 端末からの応答, device_name }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server'
import { requireGuardian } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  RP_ID, ORIGIN, CHALLENGE_COOKIE, takeChallenge, cleanDeviceName,
} from '@/lib/webauthn'
import type { Body } from '@/lib/parse'

export async function POST(req: NextRequest) {
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const body: Body = (await req.json().catch(() => null)) ?? {}

  const challenge = await takeChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value, 'register', guardian.id)
  if (!challenge) {
    return NextResponse.json({ error: '時間が過ぎました。もう一度お試しください。' }, { status: 400 })
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    })
  } catch {
    return NextResponse.json({ error: '登録を確かめられませんでした。もう一度お試しください。' }, { status: 400 })
  }

  if (!verification.verified) {
    return NextResponse.json({ error: '登録を確かめられませんでした。もう一度お試しください。' }, { status: 400 })
  }

  const { credential } = verification.registrationInfo
  const { error } = await supabaseAdmin.from('guardian_passkeys').insert({
    guardian_id: guardian.id,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports ?? null,
    device_name: cleanDeviceName(body.device_name),
  })

  if (error) {
    const msg = error.code === '23505' ? 'この端末はすでに登録されています' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete(CHALLENGE_COOKIE)
  return res
}
