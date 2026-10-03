/* lib/roles.ts — 職員の役割（proxy・API・管理者ログイン画面で共用） */

export const STAFF_ROLES = ['nutritionist', 'admin'] as const

/** 管理画面を使える役割かどうか */
export const isStaffRole = (role?: string | null): boolean =>
  !!role && (STAFF_ROLES as readonly string[]).includes(role)
