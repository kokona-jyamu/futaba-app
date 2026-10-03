/* app/api/questions/route.ts
 *
 * 保護者からの質問。回数制限をサーバー側で判定する。
 * ブラウザ側だけの制限は開発者ツールで回避できるため、
 * ここを通さないと送信できない形にする。
 * 読み取りもここを通す（RLS では messages の select を許可しない）。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { WEEKLY_LIMIT, weekStartOf } from '@/lib/questionLimit'

async function requireGuardian() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: guardian } = await supabaseAdmin
    .from('guardians')
    .select('id, child_id, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!guardian) {
    throw NextResponse.json({ error: '保護者アカウントではありません' }, { status: 403 })
  }

  return guardian
}

/** 今週の使用回数を数える */
async function countThisWeek(guardianId: string) {
  const week = weekStartOf()
  const { count } = await supabaseAdmin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('guardian_id', guardianId)
    .eq('is_nutritionist', false)
    .eq('week_start', week)

  return { used: count ?? 0, week }
}

/* ================================================================
   GET: 今週の残り回数と、自分が送った質問・それへの返信を返す
   ?menu_id=... を付けると、その献立への質問だけに絞る
   ほかの家庭の質問は返さない（園児名が分かってしまうため）
   ================================================================ */
export async function GET(req: Request) {
  let guardian
  try {
    guardian = await requireGuardian()
  } catch (res) {
    return res as NextResponse
  }

  const { used } = await countThisWeek(guardian.id)

  const menuId = new URL(req.url).searchParams.get('menu_id')

  let query = supabaseAdmin
    .from('messages')
    .select('id, menu_id, body, created_at, menus(title, served_date)')
    .eq('guardian_id', guardian.id)
    .eq('is_nutritionist', false)
    .order('created_at', { ascending: false })
  if (menuId) query = query.eq('menu_id', menuId)

  const { data: mine, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  /* 自分の質問への返信だけを replied_to で拾う */
  const ids = (mine ?? []).map((q) => q.id)
  const { data: replies } = ids.length > 0
    ? await supabaseAdmin
        .from('messages')
        .select('id, body, created_at, replied_to, sender_name')
        .eq('is_nutritionist', true)
        .in('replied_to', ids)
        .order('created_at', { ascending: true })
    : { data: [] }

  return NextResponse.json({
    used,
    limit: WEEKLY_LIMIT,
    remaining: Math.max(WEEKLY_LIMIT - used, 0),
    questions: (mine ?? []).map((q) => ({
      ...q,
      replies: (replies ?? []).filter((r) => r.replied_to === q.id),
    })),
  })
}

/* ================================================================
   POST: 質問を送る
   body: { menu_id, body }
   ================================================================ */
export async function POST(req: Request) {
  let guardian
  try {
    guardian = await requireGuardian()
  } catch (res) {
    return res as NextResponse
  }

  const payload = await req.json().catch(() => null)
  const menu_id = String(payload?.menu_id ?? '')
  const text = String(payload?.body ?? '').trim()

  if (!menu_id || !text) {
    return NextResponse.json({ error: '質問の内容が空です' }, { status: 400 })
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: '長すぎます。1000文字までにしてください' }, { status: 400 })
  }

  /* 回数の確認 */
  const { used, week } = await countThisWeek(guardian.id)
  if (used >= WEEKLY_LIMIT) {
    return NextResponse.json(
      { error: '今週の質問は上限に達しています', remaining: 0 },
      { status: 429 }
    )
  }

  /* 自園の献立かどうか確認する */
  const { data: menu } = await supabaseAdmin
    .from('menus')
    .select('id')
    .eq('id', menu_id)
    .eq('school_id', guardian.school_id)
    .maybeSingle()

  if (!menu) {
    return NextResponse.json({ error: '対象の献立が見つかりません' }, { status: 404 })
  }

  /* 園児名を取って送信者名にする */
  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name')
    .eq('id', guardian.child_id)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      menu_id,
      body: text,
      sender_name: child?.name ? `${child.name}の保護者` : '保護者',
      guardian_id: guardian.id,
      is_nutritionist: false,
      is_public: true,
      week_start: week,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    message: data,
    remaining: Math.max(WEEKLY_LIMIT - used - 1, 0),
  })
}