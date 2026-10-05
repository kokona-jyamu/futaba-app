/* app/api/admin/photo-kinds/route.ts
 *
 * 献立写真の「種類」（主食・汁物・主菜・副菜 など）の設定。
 * 「使う」にできる種類の数は schools.photo_kind_limit まで（標準 4）。
 * 上限を増やすのは運営者が行う（園の職員は変えられない）。
 * 過去の写真が消えないよう、種類は削除せず「使わない」にする。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPhotoKinds, getPhotoKindLimit } from '@/lib/photoKinds'
import { str, type Body } from '@/lib/parse'
import type { TablesUpdate } from '@/lib/database.types'
import type { PhotoKindsResponse, PhotoKindResponse } from '@/lib/apiTypes'

const LABEL_MAX = 20
const KIND_COLUMNS = 'id, label, preset_key, sort_order, is_active'

const limitMessage = (limit: number) =>
  `写真の種類は${limit}つまで使えます。枠を増やす場合は運営までお問い合わせください。`

/** 名前を確かめる。問題なければ前後の空白を除いた名前を返す */
const checkLabel = (value: unknown): { ok: true; label: string } | { ok: false; error: string } => {
  const label = str(value)?.trim()
  if (!label) return { ok: false, error: '種類の名前を入力してください' }
  if (label.length > LABEL_MAX) return { ok: false, error: `名前は${LABEL_MAX}文字までにしてください` }
  return { ok: true, label }
}

/* ================================================================
   GET: 種類の一覧と上限
   ================================================================ */
export async function GET() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const [kinds, limit] = await Promise.all([
    getPhotoKinds(staff.school_id),
    getPhotoKindLimit(staff.school_id),
  ])

  return NextResponse.json<PhotoKindsResponse>({ kinds, limit })
}

/* ================================================================
   POST: 種類を追加する（「使う」状態で追加する）
   body: { label }
   ================================================================ */
export async function POST(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const checked = checkLabel(body.label)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const [kinds, limit] = await Promise.all([
    getPhotoKinds(staff.school_id),
    getPhotoKindLimit(staff.school_id),
  ])

  if (kinds.filter((k) => k.is_active).length >= limit) {
    return NextResponse.json({ error: limitMessage(limit) }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('school_photo_kinds')
    .insert({
      school_id: staff.school_id,
      label: checked.label,
      sort_order: Math.max(0, ...kinds.map((k) => k.sort_order)) + 10,
    })
    .select(KIND_COLUMNS)
    .single()

  if (error) {
    const msg = error.code === '23505'
      ? '同じ名前の種類があります。使っていない種類なら「使う」に切り替えてください'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json<PhotoKindResponse>({ kind: data })
}

/* ================================================================
   PATCH: 名前・並び順・使う／使わないを変える
   body: { id, label?, sort_order?, is_active? }
   ================================================================ */
export async function PATCH(req: Request) {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  const body: Body = (await req.json().catch(() => null)) ?? {}
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const kinds = await getPhotoKinds(staff.school_id)
  const target = kinds.find((k) => k.id === id)
  if (!target) return NextResponse.json({ error: '対象の種類が見つかりません' }, { status: 404 })

  const patch: TablesUpdate<'school_photo_kinds'> = {}

  if (body.label !== undefined) {
    const checked = checkLabel(body.label)
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
    patch.label = checked.label
  }

  if (body.sort_order !== undefined) {
    const order = Number(body.sort_order)
    if (!Number.isInteger(order)) {
      return NextResponse.json({ error: '並び順が不正です' }, { status: 400 })
    }
    patch.sort_order = order
  }

  if (body.is_active !== undefined) {
    const nextActive = body.is_active === true
    /* 使わない → 使う に変えるときだけ、上限を確かめる */
    if (nextActive && !target.is_active) {
      const limit = await getPhotoKindLimit(staff.school_id)
      if (kinds.filter((k) => k.is_active).length >= limit) {
        return NextResponse.json({ error: limitMessage(limit) }, { status: 403 })
      }
    }
    patch.is_active = nextActive
  }

  const { data, error } = await supabaseAdmin
    .from('school_photo_kinds')
    .update(patch)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select(KIND_COLUMNS)
    .single()

  if (error) {
    const msg = error.code === '23505' ? '同じ名前の種類があります' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json<PhotoKindResponse>({ kind: data })
}
