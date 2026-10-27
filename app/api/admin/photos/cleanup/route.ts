/* app/api/admin/photos/cleanup/route.ts
 *
 * どこからも使われていない写真ファイルの片付け（管理画面「設定」）。
 *  GET : 消せる写真の数・合計の大きさ・見本を返す（まだ消さない）
 *  POST: もう一度サーバーで調べ直してから消す（画面から届いた一覧は使わない）
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GRACE_DAYS, PHOTO_BUCKET, findUnusedPhotos, photoUrlOf } from '@/lib/photoCleanup'
import type { PhotoCleanupResponse, PhotoCleanupDoneResponse } from '@/lib/apiTypes'

const SAMPLE_MAX = 12
const REMOVE_CHUNK = 100

export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const unused = await findUnusedPhotos(staff.school_id).catch(() => null)
  if (!unused) return NextResponse.json({ error: '写真を調べられませんでした' }, { status: 500 })

  return NextResponse.json<PhotoCleanupResponse>({
    count: unused.length,
    bytes: unused.reduce((sum, f) => sum + f.size, 0),
    graceDays: GRACE_DAYS,
    samples: [...unused]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, SAMPLE_MAX)
      .map((f) => ({ url: photoUrlOf(f.path), created_at: f.created_at })),
  })
}

export async function POST() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const unused = await findUnusedPhotos(staff.school_id).catch(() => null)
  if (!unused) return NextResponse.json({ error: '写真を調べられませんでした。何も削除していません' }, { status: 500 })

  let deleted = 0
  for (let i = 0; i < unused.length; i += REMOVE_CHUNK) {
    const paths = unused.slice(i, i + REMOVE_CHUNK).map((f) => f.path)
    const { data, error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).remove(paths)
    if (error) {
      return NextResponse.json(
        { error: `${deleted}枚を削除したところで止まりました（${error.message}）` },
        { status: 500 }
      )
    }
    deleted += data?.length ?? 0
  }

  return NextResponse.json<PhotoCleanupDoneResponse>({ deleted })
}
