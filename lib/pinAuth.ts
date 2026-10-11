/* lib/pinAuth.ts — 保護者の PIN ログイン（サーバー専用）
 *
 * PIN はアプリのサーバーで確かめる。Supabase Auth のパスワードは誰も知らないランダムな値にし、
 * Supabase に直接ログインを試しても通らないようにする（総当たり対策）。
 *
 *  - guardian_credentials … PIN を scrypt で変換したもの（元に戻せない。管理者も見られない）
 *  - guardian_login_locks … 出席番号ごとの失敗回数とロック
 *      3回続けて間違えると15分ロック、最後の成功から合計10回で、園が再発行するまでロック
 *      （数え方は DB の関数 guardian_login_failed にある）
 *
 * 旧方式（Supabase のパスワード＝futaba_出席番号_4桁PIN）のアカウントは、
 * 移行期限までにログインしたときに、その場で新しい仕組みに切り替える。
 */

import 'server-only'
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { noToEmail } from '@/lib/guardian'
import { todayStr } from '@/lib/date'

const scryptAsync = promisify(scrypt) as (
  password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }
) => Promise<Buffer>

/** 旧方式（4桁PIN）でログインできる最後の日（日本時間） */
export const LEGACY_PIN_LOGIN_UNTIL = '2026-11-30'

export const isLegacyPeriod = () => todayStr() <= LEGACY_PIN_LOGIN_UNTIL

/** ロックの表の鍵にする出席番号（前後の空白を除き、小文字にそろえる） */
export const lockKeyOf = (loginNo: string) => loginNo.trim().toLowerCase()

/* ----------------------------------------------------------------
   PIN の変換と確認
   ---------------------------------------------------------------- */

const SCRYPT = { N: 16384, r: 8, p: 1 }
const KEYLEN = 32

/** PIN を元に戻せない形にする（scrypt$N$r$p$salt$hash） */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(pin, salt, KEYLEN, SCRYPT)
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$')
}

/** PIN が保存したものと一致するか（時間差で手掛かりを与えない比べ方をする） */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split('$')
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scryptAsync(pin, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** 出席番号が存在しないときも同じだけ時間をかける（番号の有無を探られないように） */
let dummyHash: Promise<string> | null = null
export async function verifyDummy(pin: string): Promise<void> {
  dummyHash ??= hashPin('000000')
  await verifyPin(pin, await dummyHash)
}

/* ----------------------------------------------------------------
   PIN の発行
   ---------------------------------------------------------------- */

const WEAK_PINS = new Set([
  '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999',
  '123456', '234567', '345678', '456789', '012345', '654321', '987654', '543210', '121212', '112233',
])

/** 6桁の PIN を、推測されにくい乱数で作る（並びや繰り返しの弱いものは避ける） */
export function generatePin6(): string {
  let pin = ''
  do {
    pin = String(randomInt(0, 1_000_000)).padStart(6, '0')
  } while (WEAK_PINS.has(pin))
  return pin
}

/** Supabase Auth のパスワード用。誰にも知らせないランダムな値 */
export const randomAuthPassword = () => `${randomBytes(32).toString('base64url')}Aa1!`

/**
 * 保護者に新しい PIN を発行する（新規・一括・再発行で共通）。
 *  - PIN を変換して保存する
 *  - Supabase のパスワードをランダムな値に変える
 *  - その出席番号のロックを解く
 * 返した PIN はこの1回だけ画面に出す。
 */
export async function issuePin(guardianId: string, loginNo: string): Promise<{ pin: string } | { error: string }> {
  const pin = generatePin6()

  const { error: credErr } = await supabaseAdmin
    .from('guardian_credentials')
    .upsert({ guardian_id: guardianId, pin_hash: await hashPin(pin), updated_at: new Date().toISOString() })
  if (credErr) return { error: credErr.message }

  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(guardianId, {
    password: randomAuthPassword(),
  })
  if (authErr) return { error: authErr.message }

  await clearLock(loginNo)
  return { pin }
}

/* ----------------------------------------------------------------
   旧方式（移行期間のみ）
   ---------------------------------------------------------------- */

/** 旧方式のパスワード。移行期間の確認にだけ使う */
const legacyPassword = (loginNo: string, pin: string) => `futaba_${loginNo.trim()}_${pin.trim()}`

/**
 * 旧方式の PIN が正しいかを、Supabase に問い合わせて確かめる。
 * ログイン状態は作らない（保存しない使い捨てのクライアントで確かめる）。
 */
export async function verifyLegacyPin(loginNo: string, pin: string): Promise<boolean> {
  const probe = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error } = await probe.auth.signInWithPassword({
    email: noToEmail(loginNo),
    password: legacyPassword(loginNo, pin),
  })
  return !error
}

/**
 * 旧方式のアカウントを新しい仕組みに切り替える。
 * いま使っている PIN をそのまま変換して保存し、Supabase のパスワードはランダムな値にする。
 */
export async function migrateLegacy(guardianId: string, pin: string): Promise<string | null> {
  const { error: credErr } = await supabaseAdmin
    .from('guardian_credentials')
    .upsert({ guardian_id: guardianId, pin_hash: await hashPin(pin), updated_at: new Date().toISOString() })
  if (credErr) return credErr.message

  const { error } = await supabaseAdmin.auth.admin.updateUserById(guardianId, { password: randomAuthPassword() })
  return error?.message ?? null
}

/* ----------------------------------------------------------------
   ロック
   ---------------------------------------------------------------- */

export type LockState = {
  failed_streak: number
  failed_total: number
  locked_until: string | null
  hard_locked: boolean
}

/** いまのロックの状態。記録がなければ null */
export async function readLock(loginNo: string): Promise<LockState | null> {
  const { data } = await supabaseAdmin
    .from('guardian_login_locks')
    .select('failed_streak, failed_total, locked_until, hard_locked')
    .eq('login_no', lockKeyOf(loginNo))
    .maybeSingle()
  return data
}

/** 失敗を1回記録して、記録後の状態を返す */
export async function recordFailure(loginNo: string): Promise<LockState | null> {
  const { data } = await supabaseAdmin.rpc('guardian_login_failed', { p_login_no: lockKeyOf(loginNo) })
  return data?.[0] ?? null
}

/** 成功したとき・再発行したときに、回数とロックを消す */
export async function clearLock(loginNo: string): Promise<void> {
  await supabaseAdmin.from('guardian_login_locks').delete().eq('login_no', lockKeyOf(loginNo))
}

/** ロック中なら、そのことを伝える文言を返す。ロックされていなければ null */
export function lockMessage(lock: LockState | null, now = new Date()): string | null {
  if (!lock) return null
  if (lock.hard_locked) {
    return '間違いが続いたため、このアカウントはロックされています。園にPINの再発行をお申し出ください。'
  }
  if (lock.locked_until && new Date(lock.locked_until) > now) {
    const minutes = Math.ceil((new Date(lock.locked_until).getTime() - now.getTime()) / 60000)
    return `3回続けて間違えたため、ログインを一時的に止めています。あと${minutes}分ほどたってからお試しください。`
  }
  return null
}
