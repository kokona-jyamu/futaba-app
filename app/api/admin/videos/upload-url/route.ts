/* app/api/admin/videos/upload-url/route.ts
 *
 * 食育の動画をアップロードするための、1回だけ使える URL を発行する（管理画面）。
 * 保存先（非公開・園ごとのフォルダ）はサーバーで決める。
 * body: { name: 元のファイル名, size: バイト数 }
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { VIDEO_BUCKET, VIDEO_EXTENSIONS, VIDEO_MAX_MB, videoExtOf } from '@/lib/videos'
import { numOrNull, str, type Body } from '@/lib/parse'
import type { VideoUploadUrlResponse } from '@/lib/apiTypes'

export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const ext = videoExtOf(str(body.name) ?? '')
  if (!VIDEO_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: '動画のファイル（mp4・mov など）を選んでください' }, { status: 400 })
  }
  const size = numOrNull(body.size) ?? 0
  if (size > VIDEO_MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `動画は${VIDEO_MAX_MB}MBまでにしてください` }, { status: 400 })
  }

  const path = `${staff.school_id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'アップロードの準備ができませんでした' }, { status: 500 })
  }

  return NextResponse.json<VideoUploadUrlResponse>({ path: data.path, token: data.token })
}
