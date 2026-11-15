/* lib/phone.ts — 園の電話番号（画面とサーバーの両方で使う） */

/** 入力された電話番号を確かめて整える。空なら null、形がおかしければ undefined */
export function cleanPhone(value: unknown): string | null | undefined {
  const s = String(value ?? '').trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[ー－―‐]/g, '-')
  if (!s) return null
  if (!/^[0-9+][0-9-]{8,15}$/.test(s)) return undefined
  return s
}

/** 電話をかけるリンク（tel:）に使う形。数字と + だけにする */
export const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`
