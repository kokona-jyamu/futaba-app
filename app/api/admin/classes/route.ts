/* app/api/admin/classes/route.ts
 *
 * クラスのマスタ管理と、進級・卒園の処理。
 * 所属は履歴で持つので、過去の記録はそのまま残る。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { todayStr } from '@/lib/attendance'

const STAFF_ROLES = ['nutritionist', 'admin']

async function requireStaff() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    throw NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  return profile
}

/** その日時点で所属しているクラスを求める */
function activeClass(
  history: { class_id: string; start_date: string }[],
  date: string
): string | null {
  const applied = history
    .filter((h) => h.start_date <= date)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
  return applied[0]?.class_id ?? null
}

/* ================================================================
   GET: クラス一覧と、園児ごとの所属
   ================================================================ */
export async function GET() {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const { data: classes } = await supabaseAdmin
    .from('classes')
    .select('*')
    .eq('school_id', staff.school_id)
    .order('sort_order')

  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, login_no, name, class_name, is_active, graduated_at')
    .eq('school_id', staff.school_id)
    .order('login_no')

  const ids = (children ?? []).map((c) => c.id)

  const { data: history } = ids.length
    ? await supabaseAdmin
        .from('child_classes')
        .select('*')
        .in('child_id', ids)
        .order('start_date', { ascending: false })
    : { data: [] as any[] }

  const byChild = new Map<string, any[]>()
  ;(history ?? []).forEach((h) => {
    const list = byChild.get(h.child_id) ?? []
    list.push(h)
    byChild.set(h.child_id, list)
  })

  const today = todayStr()

  return NextResponse.json({
    classes: classes ?? [],
    children: (children ?? []).map((c) => ({
      ...c,
      class_id: activeClass(byChild.get(c.id) ?? [], today),
      history: byChild.get(c.id) ?? [],
    })),
  })
}

/* ================================================================
   POST: クラスを追加する
   ================================================================ */
export async function POST(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const name = String(body?.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'クラス名を入力してください' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert({
      school_id: staff.school_id,
      name,
      sort_order: Number(body?.sort_order ?? 100),
    })
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'そのクラス名はすでにあります' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ class: data })
}

/* ================================================================
   PATCH: クラスの変更／園児の所属変更／進級・卒園
   ================================================================ */
export async function PATCH(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const action = String(body?.action ?? '')

  /* ---------------- 進級（まとめて移す） ---------------- */
  if (action === 'promote') {
    const moves: { child_id: string; class_id: string }[] =
      Array.isArray(body?.moves) ? body.moves : []
    const graduates: string[] =
      Array.isArray(body?.graduates) ? body.graduates.map(String) : []
    const start_date = String(body?.start_date || todayStr())

    if (moves.length === 0 && graduates.length === 0) {
      return NextResponse.json({ error: '対象が選ばれていません' }, { status: 400 })
    }

    /* 自園の園児だけに絞る */
    const targetIds = [...moves.map((m) => m.child_id), ...graduates]
    const { data: own } = await supabaseAdmin
      .from('children')
      .select('id')
      .eq('school_id', staff.school_id)
      .in('id', targetIds)

    const ownIds = new Set((own ?? []).map((c) => c.id))

    /* 進級 */
    const validMoves = moves.filter((m) => ownIds.has(m.child_id) && m.class_id)
    if (validMoves.length > 0) {
      /* 同じ日の記録があれば置き換える */
      await supabaseAdmin
        .from('child_classes')
        .delete()
        .in('child_id', validMoves.map((m) => m.child_id))
        .eq('start_date', start_date)

      const { error } = await supabaseAdmin
        .from('child_classes')
        .insert(validMoves.map((m) => ({
          child_id: m.child_id,
          class_id: m.class_id,
          start_date,
        })))

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      /* children.class_name も同期させる */
      const { data: classes } = await supabaseAdmin
        .from('classes')
        .select('id, name')
        .eq('school_id', staff.school_id)

      const nameOf = new Map((classes ?? []).map((c) => [c.id, c.name]))

      for (const m of validMoves) {
        await supabaseAdmin
          .from('children')
          .update({ class_name: nameOf.get(m.class_id) ?? null })
          .eq('id', m.child_id)
      }
    }

    /* 卒園 */
    const validGrads = graduates.filter((id) => ownIds.has(id))
    if (validGrads.length > 0) {
      const { error } = await supabaseAdmin
        .from('children')
        .update({ is_active: false, graduated_at: start_date })
        .in('id', validGrads)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      promoted: validMoves.length,
      graduated: validGrads.length,
    })
  }

  /* ---------------- 園児1人の所属変更 ---------------- */
  if (body?.child_id) {
    const child_id = String(body.child_id)
    const class_id = String(body.class_id ?? '')
    const start_date = String(body.start_date || todayStr())

    if (!class_id) {
      return NextResponse.json({ error: 'クラスを選んでください' }, { status: 400 })
    }

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id')
      .eq('id', child_id)
      .eq('school_id', staff.school_id)
      .maybeSingle()

    if (!child) {
      return NextResponse.json({ error: '対象の園児が見つかりません' }, { status: 404 })
    }

    await supabaseAdmin
      .from('child_classes')
      .delete()
      .eq('child_id', child_id)
      .eq('start_date', start_date)

    const { data, error } = await supabaseAdmin
      .from('child_classes')
      .insert({ child_id, class_id, start_date })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    /* 今日より前の日付なら class_name も更新 */
    if (start_date <= todayStr()) {
      const { data: cls } = await supabaseAdmin
        .from('classes').select('name').eq('id', class_id).maybeSingle()
      await supabaseAdmin
        .from('children')
        .update({ class_name: cls?.name ?? null })
        .eq('id', child_id)
    }

    return NextResponse.json({ assigned: data })
  }

  /* ---------------- 在籍に戻す ---------------- */
  if (action === 'reactivate') {
    const child_id = String(body?.child_id_to_restore ?? '')
    if (!child_id) {
      return NextResponse.json({ error: '対象が選ばれていません' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('children')
      .update({ is_active: true, graduated_at: null })
      .eq('id', child_id)
      .eq('school_id', staff.school_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  /* ---------------- クラスそのものの変更 ---------------- */
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order)
  if (body.is_active !== undefined) patch.is_active = body.is_active === true

  const { data, error } = await supabaseAdmin
    .from('classes')
    .update(patch)
    .eq('id', id)
    .eq('school_id', staff.school_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ class: data })
}