/* app/api/admin/children/legacy-stop/route.ts
 *
 * 旧方式（4桁PIN）のまま新しい仕組みに切り替わっていない保護者アカウントを止める。
 * 移行期限（lib/pinAuth の LEGACY_PIN_LOGIN_UNTIL）を過ぎてから使う。
 *
 * Supabase のパスワードを誰も知らないランダムな値に変えるので、
 * 旧方式の4桁PINでは、アプリからも Supabase への直接の試行でもログインできなくなる。
 * 止めたアカウントは、PIN を再発行すれば使えるようになる。
 */

import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLegacyPeriod, randomAuthPassword } from '@/lib/pinAuth'

export async function POST() {
  const staff = await requireStaff()
  if (staff instanceof NextResponse) return staff

  if (isLegacyPeriod()) {
    return NextResponse.json(
      { error: '移行期限より前は止められません。期限を過ぎてから実行してください。' },
      { status: 400 }
    )
  }

  /* 自園の保護者のうち、新しい仕組みの PIN がまだないもの */
  const { data: guardians, error } = await supabaseAdmin
    .from('guardians')
    .select('id, guardian_credentials(guardian_id)')
    .eq('school_id', staff.school_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const targets = (guardians ?? []).filter((g) => !g.guardian_credentials)

  let stopped = 0
  const failed: string[] = []
  for (const g of targets) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(g.id, {
      password: randomAuthPassword(),
    })
    if (authErr) failed.push(authErr.message)
    else stopped++
  }

  return NextResponse.json({ stopped, failed: failed.length })
}
