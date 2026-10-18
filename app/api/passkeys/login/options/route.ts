/* app/api/passkeys/login/options/route.ts
 *
 * 生体認証でのログインの準備（ログイン前に呼ぶ）。
 * 出席番号は聞かない。どの保護者かは、端末が選んだ鍵からわかる。
 */

import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { RP_ID, CHALLENGE_COOKIE, challengeCookieOptions, saveChallenge } from '@/lib/webauthn'

export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    /* 指紋・顔などで本人を確かめることを必須にする */
    userVerification: 'required',
  })

  const id = await saveChallenge(options.challenge, 'login', null)
  if (!id) return NextResponse.json({ error: '準備できませんでした。時間をおいてお試しください。' }, { status: 500 })

  const res = NextResponse.json(options)
  res.cookies.set(CHALLENGE_COOKIE, id, challengeCookieOptions)
  return res
}
