/* lib/guardian.ts — 保護者アカウントの共通ロジック（クライアント・サーバー共用） */

import type { Tables } from '@/lib/database.types'

/**
 * 出席番号から Supabase Auth 用のメールアドレスを合成する。
 * 保護者はこのアドレスを一切目にしない。
 * ドメインは実在しないものを使う（.invalid は RFC で予約された送信不能ドメイン）。
 */
export const ACCOUNT_DOMAIN = 'futaba-hoiku.invalid'

export const noToEmail = (loginNo: string) =>
  `no-${loginNo.trim().toLowerCase()}@${ACCOUNT_DOMAIN}`

/*
 * PIN の発行・確認・ロックはサーバー専用の lib/pinAuth.ts で行う。
 * これから発行する PIN は6桁。移行期限（2026-11-30）までは旧方式の4桁も使える。
 */

/** ログイン画面で受け付ける PIN の形（6桁、移行期間中は4桁も） */
export const isValidPin = (pin: string) => /^(\d{4}|\d{6})$/.test(pin)

/* 列の定義は DB から生成した型に合わせる（npm run gen:types で更新）。
   allergens / allergens_confirmed / settings は jsonb なので、
   使うときは toAllergenMap（lib/allergens）や themeOfSettings（lib/theme）を通す */
export type Child = Tables<'children'>
export type Guardian = Tables<'guardians'>

/** 園児名から表示用のイニシャルを作る（アイコン用） */
export const initialOf = (name?: string | null) =>
  name?.trim().charAt(0) || '?'

export { NUTRIENTS, formatDate, num } from '@/lib/menu'