/* lib/guardianSession.ts — 保護者のログイン状態を作る（サーバー専用）
 *
 * PIN・生体認証のどちらでも、本人であることをアプリのサーバーで確かめたあとにここを呼ぶ。
 * Supabase の管理用 API で使い捨てのログイン用トークンを作り、すぐにそれでログインして
 * Cookie にログイン状態を保存する（メールは送らない。保護者のメールアドレスは架空のもの）。
 */

import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { noToEmail } from '@/lib/guardian'

/** 出席番号の保護者としてログイン状態を作る。失敗したら理由を返す */
export async function createGuardianSession(loginNo: string): Promise<string | null> {
  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: noToEmail(loginNo),
  })
  if (linkError || !link.properties?.hashed_token) return linkError?.message ?? 'トークンを作れませんでした'

  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })
  return error?.message ?? null
}
