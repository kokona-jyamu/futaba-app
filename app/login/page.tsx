/* app/login/page.tsx — 保護者用ログイン（出席番号 + PIN） */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { noToEmail, pinToPassword, isValidPin } from '@/lib/guardian'

export default function LoginPage() {
  const router = useRouter()
  const [loginNo, setLoginNo] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!loginNo.trim()) {
      setError('出席番号を入力してください。')
      return
    }
    if (!isValidPin(pin)) {
      setError('PINは4桁の数字です。')
      return
    }

    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: noToEmail(loginNo),
      password: pinToPassword(loginNo, pin),
    })

    setLoading(false)

    if (authError) {
      /* どちらが違うかは伝えない（総当たりの手掛かりになるため） */
      setError('出席番号かPINが違うようです。お手元の用紙をご確認ください。')
      setPin('')
      return
    }

    /* 旧方式のフラグが残っていると混乱するので掃除しておく */
    localStorage.removeItem('futaba_logged_in')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="fa-page" style={{ maxWidth: 420 }}>
      <div style={{ paddingTop: '8vh' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 40, marginBottom: 8 }}>🌱</p>
          <h1 className="fa-title">ふたば保育園</h1>
          <p className="fa-lead">給食・食育ポータル</p>
        </div>

        <section className="fa-card">
          <label className="fa-label" htmlFor="login-no">出席番号</label>
          <input
            id="login-no"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            value={loginNo}
            onChange={(e) => setLoginNo(e.target.value)}
            placeholder="例：12"
            className="fa-input"
          />

          <label className="fa-label" htmlFor="pin">PIN（4桁）</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
            placeholder="••••"
            className="fa-input"
            style={{ letterSpacing: '.4em' }}
          />

          {error && (
            <p className="fa-toast is-error" style={{ marginTop: 14, marginBottom: 0 }}>
              {error}
            </p>
          )}

          <div className="fa-actions" style={{ display: 'block' }}>
            <button
              onClick={handleLogin}
              disabled={loading}
              className="fa-btn fa-btn--primary"
              style={{ width: '100%' }}
            >
              {loading ? 'ログイン中…' : 'ログイン'}
            </button>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, lineHeight: 1.8, color: 'var(--fa-muted)' }}>
            出席番号とPINは園からお配りした用紙に記載されています。
            分からなくなった場合は担任にお声がけください。
          </p>
        </section>
      </div>
    </main>
  )
}