/* app/api/admin/replies/route.ts
 *
 * 栄養士から保護者への返信。
 * どの質問への返信かを replied_to で紐づける。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'

const STAFF_ROLES = ['nutritionist', 'admin']

async function requireStaff() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id, user_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    throw NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  return profile
}

/* ================================================================
   POST: 質問に返信する
   body: { menu_id, body, question_id }
   ================================================================ */
export async function POST(req: Request) {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  const menu_id = String(body?.menu_id ?? '')
  const question_id = body?.question_id ? String(body.question_id) : null
  const text = String(body?.body ?? '').trim()

  if (!menu_id || !text) {
    return NextResponse.json({ error: '返信内容が空です' }, { status: 400 })
  }

  /* 自園の献立かどうか確認する */
  const { data: menu } = await supabaseAdmin
    .from('menus')
    .select('id')
    .eq('id', menu_id)
    .eq('school_id', staff.school_id)
    .maybeSingle()

  if (!menu) {
    return NextResponse.json({ error: '対象の献立が見つかりません' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      menu_id,
      body: text,
      sender_name: staff.user_name || '栄養士',
      is_nutritionist: true,
      is_public: true,
      replied_to: question_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ message: data })
}

/* ================================================================
   GET: 保護者からの質問一覧（返信も一緒に返す）
   ================================================================ */
export async function GET() {
  let staff
  try {
    staff = await requireStaff()
  } catch (res) {
    return res as NextResponse
  }

  /* 質問 */
  const { data: questions, error } = await supabaseAdmin
    .from('messages')
    .select('*, menus!inner(title, served_date, school_id)')
    .eq('is_nutritionist', false)
    .eq('menus.school_id', staff.school_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const list = questions ?? []
  if (list.length === 0) return NextResponse.json({ messages: [] })

  /* それぞれへの返信 */
  const { data: replies } = await supabaseAdmin
    .from('messages')
    .select('id, body, created_at, replied_to')
    .eq('is_nutritionist', true)
    .in('replied_to', list.map((q) => q.id))
    .order('created_at', { ascending: true })

  const withReplies = list.map((q) => ({
    ...q,
    replies: (replies ?? []).filter((r) => r.replied_to === q.id),
  }))

  return NextResponse.json({ messages: withReplies })
}