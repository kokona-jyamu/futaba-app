/* app/api/guardian/route.ts
 *
 * 保護者が自分で変更できる項目の更新。
 * children / guardians への書き込みは必ずここを通す（RLS では update を許可しない）。
 * ブラウザから直接 update できると、child_id や名前まで書き換えられてしまうため、
 * 変更してよい項目だけをここで受け付ける。
 */

import { NextResponse } from 'next/server'
import { requireGuardian } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sanitizeAllergens } from '@/lib/allergens'
import { THEMES, settingsWithTheme, type ThemeKey } from '@/lib/theme'
import type { TablesUpdate } from '@/lib/database.types'

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
  const guardian = await requireGuardian()
  if (guardian instanceof NextResponse) return guardian

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '内容が空です' }, { status: 400 })
  }

  /* ---------------- アレルギー ---------------- */
  if (body.allergens !== undefined) {
    const parsed = sanitizeAllergens(body.allergens)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    /* 確認済みの内容（allergens_confirmed）は変えない。差があれば管理画面に知らせる */
    const { error } = await supabaseAdmin
      .from('children')
      .update({
        allergens: parsed.allergens,
        allergens_updated_at: new Date().toISOString(),
        allergens_updated_by: guardian.id,
        allergens_updated_by_role: 'guardian',
      })
      .eq('id', guardian.child_id)
      .eq('school_id', guardian.school_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  /* ---------------- 画面の色・最終ログイン ---------------- */
  const patch: TablesUpdate<'guardians'> = {}

  if (body.theme !== undefined) {
    const theme = String(body.theme)
    if (!THEME_KEYS.has(theme)) {
      return NextResponse.json({ error: '色の指定が不正です' }, { status: 400 })
    }
    patch.settings = settingsWithTheme(guardian.settings, theme as ThemeKey)
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
