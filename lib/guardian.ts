/* lib/guardian.ts — 保護者アカウントの共通ロジック（クライアント・サーバー共用） */

/**
 * 出席番号から Supabase Auth 用のメールアドレスを合成する。
 * 保護者はこのアドレスを一切目にしない。
 * ドメインは実在しないものを使う（.invalid は RFC で予約された送信不能ドメイン）。
 */
export const ACCOUNT_DOMAIN = 'futaba-hoiku.invalid'

export const noToEmail = (loginNo: string) =>
  `no-${loginNo.trim().toLowerCase()}@${ACCOUNT_DOMAIN}`

/**
 * PIN を Supabase Auth のパスワードに変換する。
 * Supabase は既定で6文字以上を要求するため、4桁PINをそのままは使えない。
 * 出席番号を混ぜて長さを確保しつつ、同じPINでも番号が違えば別の値になるようにする。
 */
export const pinToPassword = (loginNo: string, pin: string) =>
  `futaba_${loginNo.trim()}_${pin.trim()}`

/** 4桁のPINをランダム生成（0000 と 1234 のような弱いものは避ける） */
export const generatePin = (): string => {
  const weak = new Set(['0000', '1111', '2222', '3333', '4444', '5555',
    '6666', '7777', '8888', '9999', '1234', '4321', '0123'])
  let pin = ''
  do {
    pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  } while (weak.has(pin))
  return pin
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin)

export type Child = {
  id: string
  school_id: string
  login_no: string
  name: string
  class_name: string | null
  allergens: Record<string, boolean>
  is_active: boolean
}

export type Guardian = {
  id: string
  child_id: string
  school_id: string
  display_name: string | null
  settings: Record<string, unknown>
}

/** 園児名から表示用のイニシャルを作る（アイコン用） */
export const initialOf = (name?: string | null) =>
  name?.trim().charAt(0) || '?'