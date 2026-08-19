/* app/api/admin/replies/route.ts
 *
 * 栄養士から保護者への返信。
 * RLS では「is_nutritionist = true の行は保護者が書けない」ようにするため、
 * 職員の返信はここを通す。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'

const STAFF_ROLES = ['nutritionist', 'admin']

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id, user_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const menu_id = String(body?.menu_id ?? '')
  const text = String(body?.body ?? '').trim()

  if (!menu_id || !text) {
    return NextResponse.json({ error: '返信内容が空です' }, { status: 400 })
  }

  /* 自園の献立かどうか確認する */
  const { data: menu } = await supabaseAdmin
    .from('menus')
    .select('id')
    .eq('id', menu_id)
    .eq('school_id', profile.school_id)
    .maybeSingle()

  if (!menu) {
    return NextResponse.json({ error: '対象の献立が見つかりません' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      menu_id,
      body: text,
      sender_name: profile.user_name || '栄養士',
      is_nutritionist: true,
      is_public: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ message: data })
}

/* ================================================================
   GET: 保護者からの質問一覧（RLS を掛けると職員から見えなくなるため）
   ================================================================ */
export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*, menus!inner(title, served_date, school_id)')
    .eq('is_nutritionist', false)
    .eq('menus.school_id', profile.school_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ messages: data ?? [] })
}