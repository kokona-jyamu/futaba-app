/* lib/webauthn.ts — 保護者の生体認証（パスキー）の共通処理（サーバー専用）
 *
 * 指紋・顔の情報はスマホの外に出ない。サーバーが持つのは端末ごとの公開鍵だけ（guardian_passkeys）。
 * 登録・ログインのたびに使い捨ての合言葉（challenge）を作り、端末がそれに署名したものを確かめる。
 *
 * パスキーはドメインごとに登録される。ドメインを変えると登録済みのものは使えなくなるので、
 * 本番のドメインは環境変数で決める（WEBAUTHN_RP_ID 例：futaba-app.vercel.app、
 * WEBAUTHN_ORIGIN 例：https://futaba-app.vercel.app）。
 */

import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const isProduction = process.env.NODE_ENV === 'production'

/** パスキーを結び付けるドメイン */
export const RP_ID = process.env.WEBAUTHN_RP_ID ?? (isProduction ? 'futaba-app.vercel.app' : 'localhost')

/** ブラウザで開いているページの URL の先頭（https://ドメイン） */
export const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? (isProduction ? `https://${RP_ID}` : 'http://localhost:3000')

/** 端末の生体認証の画面に出る名前 */
export const RP_NAME = 'ふたば保育園 給食・食育ポータル'

/** 合言葉を受け渡す Cookie（ブラウザの JavaScript からは読めない） */
export const CHALLENGE_COOKIE = 'futaba_webauthn'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export const challengeCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  path: '/api/passkeys',
  maxAge: CHALLENGE_TTL_MS / 1000,
}

type Purpose = 'register' | 'login'

/** 合言葉を保存し、Cookie に入れる ID を返す（期限切れのものはついでに消す） */
export async function saveChallenge(
  challenge: string,
  purpose: Purpose,
  guardianId: string | null
): Promise<string | null> {
  await supabaseAdmin.from('webauthn_challenges').delete().lt('expires_at', new Date().toISOString())

  const { data, error } = await supabaseAdmin
    .from('webauthn_challenges')
    .insert({
      challenge,
      purpose,
      guardian_id: guardianId,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .select('id')
    .single()

  return error ? null : data.id
}

/**
 * 合言葉を1回だけ取り出す（取り出したら消す）。
 * 期限切れ・用途違い・登録のときは本人違いなら null。
 */
export async function takeChallenge(
  id: string | undefined,
  purpose: Purpose,
  guardianId: string | null
): Promise<string | null> {
  if (!id) return null

  const { data } = await supabaseAdmin
    .from('webauthn_challenges')
    .delete()
    .eq('id', id)
    .select('challenge, purpose, guardian_id, expires_at')
    .maybeSingle()

  if (!data) return null
  if (data.purpose !== purpose) return null
  if (new Date(data.expires_at) < new Date()) return null
  if (purpose === 'register' && data.guardian_id !== guardianId) return null
  return data.challenge
}

/** 端末の名前（画面から届いた値を短くそろえる） */
export const cleanDeviceName = (value: unknown): string => {
  const name = typeof value === 'string' ? value.trim().slice(0, 40) : ''
  return name || 'この端末'
}
