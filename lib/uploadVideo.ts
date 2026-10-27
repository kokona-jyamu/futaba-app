/* lib/uploadVideo.ts — 管理画面から食育の動画をアップロードする（画面で使う）
 *
 * 保存先（非公開・園ごとのフォルダ）はサーバーが決め、1回だけ使える URL に直接送る。
 * 成功したら保存場所（video_path に入れる値）を返す。
 */
'use client'

import { supabase } from '@/lib/supabase'
import { fetchJson } from '@/lib/useLoadEffect'
import { VIDEO_BUCKET, VIDEO_TYPES, videoExtOf } from '@/lib/videos'
import type { VideoUploadUrlResponse } from '@/lib/apiTypes'

export async function uploadVideo(
  file: File
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const r = await fetchJson<VideoUploadUrlResponse>('/api/admin/videos/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, size: file.size }),
  })
  if (!r.ok) return { ok: false, error: r.json.error }

  const { error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .uploadToSignedUrl(r.json.path, r.json.token, file, { contentType: file.type || VIDEO_TYPES[videoExtOf(file.name)] })
  if (error) return { ok: false, error: error.message }

  return { ok: true, path: r.json.path }
}
