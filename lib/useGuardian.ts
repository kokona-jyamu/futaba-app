/* lib/useGuardian.ts — ログイン中の保護者と園児の情報を取る */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Child, Guardian } from '@/lib/guardian'

export type GuardianState = {
  loading: boolean
  guardian: Guardian | null
  child: Child | null
  /** 未ログインなら true */
  signedOut: boolean
  reload: () => Promise<void>
}

export function useGuardian(): GuardianState {
  const [loading, setLoading] = useState(true)
  const [guardian, setGuardian] = useState<Guardian | null>(null)
  const [child, setChild] = useState<Child | null>(null)
  const [signedOut, setSignedOut] = useState(false)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setSignedOut(true)
      setLoading(false)
      return
    }

    /* guardians と children は RLS で自分の行だけ見える */
    const { data: g } = await supabase
      .from('guardians')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!g) {
      /* 職員アカウントでトップに来た場合などはここに落ちる */
      setLoading(false)
      return
    }

    const { data: c } = await supabase
      .from('children')
      .select('*')
      .eq('id', g.child_id)
      .maybeSingle()

    setGuardian(g)
    setChild(c ?? null)
    setLoading(false)

    /* 最終ログイン日時を記録（失敗しても画面には影響させない） */
    supabase
      .from('guardians')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .then(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  return { loading, guardian, child, signedOut, reload: load }
}