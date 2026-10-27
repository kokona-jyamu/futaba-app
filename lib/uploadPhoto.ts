/* lib/uploadPhoto.ts — 管理画面から写真をアップロードする（画面で使う）
 *
 * 保存先はサーバーが決め（園ごとのフォルダ）、1回だけ使える URL に直接送る。
 * 献立の写真は公開の場所（表示用の URL を返す）、食育の写真は非公開の場所（保存場所を返す）に入れる。
 */
'use client'

import { supabase } from '@/lib/supabase'
import { fetchJson } from '@/lib/useLoadEffect'
import type { PhotoUploadUrlResponse } from '@/lib/apiTypes'

type Uploaded = { ok: true; path: string; url: string | null } | { ok: false; error: string }

async function upload(file: File, bucket: string, prefix?: 'event'): Promise<Uploaded> {
  const r = await fetchJson<PhotoUploadUrlResponse>('/api/admin/photos/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, prefix }),
  })
  if (!r.ok) return { ok: false, error: r.json.error }

  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(r.json.path, r.json.token, file)
  if (error) return { ok: false, error: error.message }

  return { ok: true, path: r.json.path, url: r.json.publicUrl }
}

/** 献立の写真。成功したら表示用の URL を返す */
export async function uploadPhoto(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await upload(file, 'menu-photos')
  if (!r.ok) return r
  return r.url ? { ok: true, url: r.url } : { ok: false, error: '表示用の URL を作れませんでした' }
}

/** 食育の写真（園の関係者だけが見られる場所）。成功したら保存場所（photo_path に入れる値）を返す */
export async function uploadEventPhoto(file: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const r = await upload(file, 'event-photos', 'event')
  return r.ok ? { ok: true, path: r.path } : r
}
