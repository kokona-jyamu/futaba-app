/* app/api/admin/photos/upload-url/route.ts
 *
 * 写真をアップロードするための、1回だけ使える URL を発行する（管理画面）。
 * 保存先のフォルダ（園ごと）はサーバーで決める。画面に園の ID を持たせないため。
 * 画面はこの URL に直接ファイルを送る（大きな写真をサーバー経由で運ばない）。
 * body: { name: 元のファイル名, prefix?: 'event' }
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PHOTO_BUCKET } from '@/lib/photoCleanup'
import { str, type Body } from '@/lib/parse'
import type { PhotoUploadUrlResponse } from '@/lib/apiTypes'

/** 受け付ける写真の拡張子 */
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']

export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const ext = (str(body.name) ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (!EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: '写真のファイル（jpg・png など）を選んでください' }, { status: 400 })
  }

  const prefix = body.prefix === 'event' ? 'event-' : ''
  const path = `${staff.school_id}/${prefix}${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'アップロードの準備ができませんでした' }, { status: 500 })
  }

  return NextResponse.json<PhotoUploadUrlResponse>({
    path: data.path,
    token: data.token,
    publicUrl: supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(data.path).data.publicUrl,
  })
}
