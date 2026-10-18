/* app/api/passkeys/register/options/route.ts
 *
 * 生体認証の登録の準備。ログイン中の保護者だけが、自分の端末を登録できる。
 * 合言葉を作って保存し、端末に渡す登録の条件を返す。
 */

import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { requireGuardian } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  RP_ID, RP_NAME, CHALLENGE_COOKIE, challengeCookieOptions, saveChallenge,
} from '@/lib/webauthn'

export async function POST() {
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const [{ data: child }, { data: existing }] = await Promise.all([
    supabaseAdmin.from('children').select('login_no, name').eq('id', guardian.child_id).maybeSingle(),
    supabaseAdmin.from('guardian_passkeys').select('credential_id, transports').eq('guardian_id', guardian.id),
  ])
  if (!child) return NextResponse.json({ error: '園児の情報が見つかりません' }, { status: 404 })

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    /* 端末の生体認証の一覧に出る名前 */
    userName: `ふたば保育園 No.${child.login_no}`,
    userDisplayName: `${child.name}さんの保護者`,
    userID: new TextEncoder().encode(guardian.id),
    attestationType: 'none',
    /* 同じ端末を二重に登録しない */
    excludeCredentials: (existing ?? []).map((p) => ({
      id: p.credential_id,
      transports: p.transports ?? undefined,
    })),
    authenticatorSelection: {
      /* 出席番号を入れずにログインできるよう、端末に鍵を保存してもらう */
      residentKey: 'required',
      /* 指紋・顔などで本人を確かめることを必須にする */
      userVerification: 'required',
    },
  })

  const id = await saveChallenge(options.challenge, 'register', guardian.id)
  if (!id) return NextResponse.json({ error: '準備できませんでした。時間をおいてお試しください。' }, { status: 500 })

  const res = NextResponse.json(options)
  res.cookies.set(CHALLENGE_COOKIE, id, challengeCookieOptions)
  return res
}
