/* app/api/login/route.ts
 *
 * 保護者のログイン（出席番号＋PIN）。PIN はここで確かめ、正しければサーバー側でログイン状態を作る。
 * Supabase Auth のパスワードは誰も知らないランダムな値なので、Supabase に直接ログインを試しても通らない。
 *
 *  1. ロック中なら、PIN を確かめずに断る（ロック中に総当たりを続けられないように）
 *  2. 新しい仕組みのアカウントは、保存した PIN と照らし合わせる
 *  3. 旧方式のアカウントは、移行期限まで4桁PINで確かめ、正しければその場で切り替える
 *  4. 存在しない出席番号も、同じだけ時間をかけて同じ文言を返す（番号の有無を探られないように）
 *  5. 失敗は1回ずつ記録する（3回続けて15分ロック、合計10回で再発行までロック）
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { noToEmail } from '@/lib/guardian'
import {
  isLegacyPeriod, verifyPin, verifyDummy, verifyLegacyPin, migrateLegacy,
  readLock, recordFailure, clearLock, lockMessage,
} from '@/lib/pinAuth'
import type { Body } from '@/lib/parse'

const WRONG = '出席番号かPINが違うようです。お手元の用紙をご確認ください。'

/** 出席番号から保護者を探す。見つからない・同じ番号が複数あるときは null */
async function findGuardian(loginNo: string) {
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id')
    .eq('login_no', loginNo)
    .eq('is_active', true)
    .limit(2)
  if (!children || children.length !== 1) return null

  const { data: guardian } = await supabaseAdmin
    .from('guardians')
    .select('id')
    .eq('child_id', children[0].id)
    .maybeSingle()
  return guardian
}

/** PIN を確かめる。正しければ保護者のID、違えば null */
async function checkPin(loginNo: string, pin: string): Promise<string | null> {
  const guardian = await findGuardian(loginNo)
  if (!guardian) {
    await verifyDummy(pin)
    return null
  }

  const { data: cred } = await supabaseAdmin
    .from('guardian_credentials')
    .select('pin_hash')
    .eq('guardian_id', guardian.id)
    .maybeSingle()

  /* 新しい仕組みのアカウント */
  if (cred) return (await verifyPin(pin, cred.pin_hash)) ? guardian.id : null

  /* 旧方式のアカウント（移行期限まで・4桁のみ） */
  await verifyDummy(pin)
  if (!isLegacyPeriod() || !/^\d{4}$/.test(pin)) return null
  if (!(await verifyLegacyPin(loginNo, pin))) return null

  const migrateError = await migrateLegacy(guardian.id, pin)
  if (migrateError) console.error('旧方式からの切り替えに失敗', migrateError)
  return guardian.id
}

export async function POST(req: Request) {
  const body: Body = (await req.json().catch(() => null)) ?? {}
  const loginNo = String(body.login_no ?? '').trim()
  const pin = String(body.pin ?? '').trim()

  if (!loginNo || loginNo.length > 20 || !/^(\d{4}|\d{6})$/.test(pin)) {
    return NextResponse.json({ error: '出席番号と、4桁または6桁のPINを入力してください。' }, { status: 400 })
  }

  /* 1. ロック中なら確かめずに断る */
  const locked = lockMessage(await readLock(loginNo))
  if (locked) return NextResponse.json({ error: locked }, { status: 423 })

  /* 2〜4. PIN を確かめる */
  const guardianId = await checkPin(loginNo, pin)

  /* 5. 失敗を記録して、残りの回数かロックを伝える */
  if (!guardianId) {
    const lock = await recordFailure(loginNo)
    const lockedNow = lockMessage(lock)
    if (lockedNow) return NextResponse.json({ error: lockedNow }, { status: 423 })

    const left = lock ? 3 - (lock.failed_streak % 3) : null
    const hint = left ? `あと${left}回間違えると、15分間ログインできなくなります。` : ''
    return NextResponse.json({ error: `${WRONG}${hint}` }, { status: 401 })
  }

  /* 成功：回数を消し、サーバー側でログイン状態を作る（Cookie に保存される） */
  await clearLock(loginNo)

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: noToEmail(loginNo),
  })
  if (linkError || !link.properties?.hashed_token) {
    return NextResponse.json({ error: 'ログインできませんでした。時間をおいてお試しください。' }, { status: 500 })
  }

  const supabase = await createSupabaseServer()
  const { error: sessionError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })
  if (sessionError) {
    return NextResponse.json({ error: 'ログインできませんでした。時間をおいてお試しください。' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
