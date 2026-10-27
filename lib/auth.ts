/* lib/auth.ts — API ルートの認可（サーバー専用）
 *
 * Cookie のセッションからユーザーを取得し、職員・保護者のどちらかを確認する。
 * 確認できなければ、そのまま返せる NextResponse を返す。呼び出し側は
 *
 *   const staff = await requireStaff()
 *   if (staff instanceof NextResponse) return staff
 *
 * と書く。users / guardians は RLS で自分の行しか読めないため、
 * 確認には secret キーのクライアントを使う。
 *
 * 職員は2段階認証（認証アプリの確認コード）まで済んでいること（aal2）も確かめる。
 * パスワードだけでログインした状態では、職員用の API は使えない。
 */

import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { isStaffRole } from '@/lib/roles'
import type { Json } from '@/lib/database.types'

export type Staff = {
  id: string
  role: string
  /** 職員は必ずどこかの園に所属している（所属のないアカウントは requireStaff で断る） */
  school_id: string
  user_name: string | null
}

export type GuardianAccount = {
  id: string
  child_id: string
  school_id: string
  settings: Json
}

/** ログイン中のユーザーID。未ログインなら null */
async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** 2段階認証（確認コード）まで済んでいるか */
async function hasSecondFactor(): Promise<boolean> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.currentLevel === 'aal2'
}

/** 職員（栄養士・園管理者）であることを確認し、その school_id などを返す */
export async function requireStaff(): Promise<Staff | NextResponse> {
  const userId = await currentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, school_id, user_name')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || !isStaffRole(profile.role)) {
    return NextResponse.json({ error: 'この操作の権限がありません' }, { status: 403 })
  }

  /* パスワードだけでは使わせない（確認コードまで済んでいること） */
  if (!(await hasSecondFactor())) {
    return NextResponse.json(
      { error: '2段階認証が済んでいません。管理画面にログインし直してください。' },
      { status: 403 }
    )
  }

  /* 所属する園が決まっていないと、どの園のデータを扱うか決められない */
  if (!profile.school_id) {
    return NextResponse.json(
      { error: 'このアカウントには所属する園が設定されていません。管理者にお問い合わせください。' },
      { status: 403 }
    )
  }

  return { ...profile, school_id: profile.school_id }
}

/**
 * 園の関係者（保護者・職員）であることを確認し、その園を返す。
 * 保護者と職員の両方が見るもの（食育の動画など）に使う。職員は2段階認証まで確かめる。
 */
export async function requireSchoolMember(): Promise<{ school_id: string } | NextResponse> {
  const guardian = await requireGuardian()
  if (!(guardian instanceof NextResponse)) return { school_id: guardian.school_id }
  /* ログインしていなければ、職員かどうかを調べるまでもない */
  if (guardian.status === 401) return guardian
  return requireStaff()
}

/** 保護者であることを確認し、紐づく園児・園を返す */
export async function requireGuardian(): Promise<GuardianAccount | NextResponse> {
  const userId = await currentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: guardian } = await supabaseAdmin
    .from('guardians')
    .select('id, child_id, school_id, settings')
    .eq('id', userId)
    .maybeSingle()

  if (!guardian) {
    return NextResponse.json({ error: '保護者アカウントではありません' }, { status: 403 })
  }

  return guardian
}
