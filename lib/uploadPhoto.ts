/* lib/uploadPhoto.ts — 管理画面から写真をアップロードする（画面で使う）
 *
 * 保存先はサーバーが決め（園ごとのフォルダ）、1回だけ使える URL に直接送る。
 * 成功したら表示用の URL、失敗したらエラーの文を返す。
 */
'use client'

import { supabase } from '@/lib/supabase'
import { fetchJson } from '@/lib/useLoadEffect'
import type { PhotoUploadUrlResponse } from '@/lib/apiTypes'

export async function uploadPhoto(
  file: File,
  prefix?: 'event'
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await fetchJson<PhotoUploadUrlResponse>('/api/admin/photos/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, prefix }),
  })
  if (!r.ok) return { ok: false, error: r.json.error }

  const { error } = await supabase.storage
    .from('menu-photos')
    .uploadToSignedUrl(r.json.path, r.json.token, file)
  if (error) return { ok: false, error: error.message }

  return { ok: true, url: r.json.publicUrl }
}
