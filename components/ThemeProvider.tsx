/* components/ThemeProvider.tsx
 *
 * 保存されたテーマ色を全ページで適用する。
 * layout.tsx に置いて、どのページを開いても効くようにする。
 *
 * 表示のちらつきを避けるため、
 *   1. まず localStorage の値を即座に当てる
 *   2. その後 DB の設定を読んで、違っていれば上書きする
 * の順で処理する。
 */
'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { applyTheme, loadThemeLocal, saveThemeLocal, type ThemeKey } from '@/lib/theme'

export default function ThemeProvider() {
  useEffect(() => {
    /* 管理画面ではテーマを適用しない（保護者の設定が混ざるため） */
    if (window.location.pathname.startsWith('/admin')) {
      applyTheme('matcha')
      return
    }
    /* 1. 端末に控えてある色をすぐ当てる */
    applyTheme(loadThemeLocal())

    /* 2. アカウントの設定を確認する */
    const sync = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('guardians')
        .select('settings')
        .eq('id', session.user.id)
        .maybeSingle()

      const theme = (data?.settings as any)?.theme as ThemeKey | undefined
      if (theme) {
        applyTheme(theme)
        saveThemeLocal(theme)
      }
    }
    sync()

    /* 3. ログアウトしたら既定色に戻す */
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        saveThemeLocal('matcha')
        applyTheme('matcha')
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return null
}