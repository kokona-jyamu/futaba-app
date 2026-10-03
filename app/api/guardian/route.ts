/* app/api/guardian/route.ts
 *
 * 保護者が自分で変更できる項目の更新。
 * children / guardians への書き込みは必ずここを通す（RLS では update を許可しない）。
 * ブラウザから直接 update できると、child_id や名前まで書き換えられてしまうため、
 * 変更してよい項目だけをここで受け付ける。
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/superbase/server'
import { STANDARD_ALLERGENS } from '@/lib/allergens'
import { THEMES } from '@/lib/theme'

async function requireGuardian() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: guardian } = await supabaseAdmin
    .from('guardians')
    .select('id, child_id, school_id, settings')
    .eq('id', user.id)
    .maybeSingle()

  if (!guardian) {
    throw NextResponse.json({ error: '保護者アカウントではありません' }, { status: 403 })
  }

  return guardian
}

const ALLERGEN_KEYS = new Set(STANDARD_ALLERGENS.map((a) => a.key))
const THEME_KEYS = new Set<string>(THEMES.map((t) => t.key))

/* ================================================================
   PATCH: 自分の子のアレルギー・画面の色・最終ログイン日時を更新する
   body: {
     allergens?: { [key]: boolean },   // 標準28品目のキーのみ
     theme?: ThemeKey,
     seen?: true,                       // 最終ログイン日時を記録する
   }
   ================================================================ */
export async function PATCH(req: Request) {
  let guardian
  try {
    guardian = await requireGuardian()
  } catch (res) {
    return res as NextResponse
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '内容が空です' }, { status: 400 })
  }

  /* ---------------- アレルギー ---------------- */
  if (body.allergens !== undefined) {
    const input = body.allergens
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return NextResponse.json({ error: 'アレルギーの形式が不正です' }, { status: 400 })
    }

    const allergens: Record<string, boolean> = {}
    for (const [key, on] of Object.entries(input)) {
      if (!ALLERGEN_KEYS.has(key) || typeof on !== 'boolean') {
        return NextResponse.json({ error: `不明な項目です：${key}` }, { status: 400 })
      }
      allergens[key] = on
    }

    const { error } = await supabaseAdmin
      .from('children')
      .update({ allergens })
      .eq('id', guardian.child_id)
      .eq('school_id', guardian.school_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  /* ---------------- 画面の色・最終ログイン ---------------- */
  const patch: Record<string, unknown> = {}

  if (body.theme !== undefined) {
    const theme = String(body.theme)
    if (!THEME_KEYS.has(theme)) {
      return NextResponse.json({ error: '色の指定が不正です' }, { status: 400 })
    }
    patch.settings = { ...(guardian.settings ?? {}), theme }
  }

  if (body.seen === true) {
    patch.last_seen_at = new Date().toISOString()
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin
      .from('guardians')
      .update(patch)
      .eq('id', guardian.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
