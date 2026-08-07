/* lib/supabaseAdmin.ts
 *
 * ⚠️ サーバー専用。'use client' のファイルからは絶対に import しないこと。
 *    SUPABASE_SERVICE_ROLE_KEY は RLS を全て無視できる鍵なので、
 *    ブラウザに渡ると全データが漏れる。
 *
 * .env.local に追加（NEXT_PUBLIC_ を付けないこと）:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 */

import 'server-only'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY

if (!url || !serviceKey) {
  throw new Error('SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL が未設定です')
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})