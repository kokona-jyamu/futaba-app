/* lib/useGuardian.ts — ログイン中の保護者と園児の情報を取る */
'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useLoadEffect } from '@/lib/useLoadEffect'
import type { Child, Guardian } from '@/lib/guardian'

export type GuardianState = {
  loading: boolean
  guardian: Guardian | null
  child: Child | null
  /** 未ログインなら true */
  signedOut: boolean
  reload: () => Promise<void>
}

type Loaded =
  | { signedOut: true }
  | { signedOut: false; guardian: Guardian | null; child: Child | null }

/** ログイン中の保護者と園児を読む（画面への反映は useGuardian 側で行う） */
async function requestGuardian(): Promise<Loaded> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { signedOut: true }

  /* guardians と children は RLS で自分の行だけ見える */
  const { data: g } = await supabase
    .from('guardians')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle()

  /* 職員アカウントでトップに来た場合などはここに落ちる */
  if (!g) return { signedOut: false, guardian: null, child: null }

  const { data: c } = await supabase
    .from('children')
    .select('*')
    .eq('id', g.child_id)
    .maybeSingle()

  /* 最終ログイン日時を記録（失敗しても画面には影響させない） */
  fetch('/api/guardian', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seen: true }),
  }).catch(() => {})

  return { signedOut: false, guardian: g, child: c ?? null }
}

export function useGuardian(): GuardianState {
  const [loading, setLoading] = useState(true)
  const [guardian, setGuardian] = useState<Guardian | null>(null)
  const [child, setChild] = useState<Child | null>(null)
  const [signedOut, setSignedOut] = useState(false)

  const apply = useCallback((r: Loaded) => {
    setLoading(false)
    if (r.signedOut) { setSignedOut(true); return }
    setGuardian(r.guardian)
    setChild(r.child)
  }, [])

  useLoadEffect(requestGuardian, apply)

  /* 保存のあとなどに取り直す */
  const reload = useCallback(async () => { apply(await requestGuardian()) }, [apply])

  return { loading, guardian, child, signedOut, reload }
}