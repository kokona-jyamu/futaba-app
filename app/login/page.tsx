/* app/login/page.tsx — 保護者用ログイン（出席番号 + PIN）
 *
 * PIN はサーバー（/api/login）で確かめる。間違いが続くとロックされる。
 * PIN は6桁。移行期限（2026-11-30）までは、これまでの4桁も使える。
 * マイページで端末を登録した方は、出席番号とPINを入れずに指紋・顔認証でもログインできる。
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidPin } from '@/lib/guardian'
import { useLoadEffect, fetchJson } from '@/lib/useLoadEffect'
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'

/** この端末（ブラウザ）が指紋・顔認証に対応しているか */
const checkSupport = async () => browserSupportsWebAuthn()

export default function LoginPage() {
  const router = useRouter()
  const [loginNo, setLoginNo] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passkeySupported, setPasskeySupported] = useState(false)

  useLoadEffect(checkSupport, setPasskeySupported)

  /** ログインできたらトップへ */
  const goHome = () => {
    /* 旧方式のフラグが残っていると混乱するので掃除しておく */
    localStorage.removeItem('futaba_logged_in')
    router.push('/')
    router.refresh()
  }

  /* ---------------- 指紋・顔認証でログイン ---------------- */

  const handlePasskeyLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const opt = await fetchJson<Parameters<typeof startAuthentication>[0]['optionsJSON']>(
        '/api/passkeys/login/options',
        { method: 'POST' }
      )
      if (!opt.ok) { setError(opt.json.error); return }

      /* ここでスマホの指紋・顔認証の画面が出る */
      const response = await startAuthentication({ optionsJSON: opt.json })

      const r = await fetchJson<{ ok: true }>('/api/passkeys/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      if (!r.ok) { setError(r.json.error); return }
      goHome()
    } catch {
      setError('指紋・顔認証をやめたか、うまくいきませんでした。もう一度お試しいただくか、PINでログインしてください。')
    } finally {
      setLoading(false)
    }
  }

  /* ---------------- 出席番号とPINでログイン ---------------- */

  const handleLogin = async () => {
    if (!loginNo.trim()) {
      setError('出席番号を入力してください。')
      return
    }
    if (!isValidPin(pin)) {
      setError('PINは6桁の数字です（これまでの4桁のPINも使えます）。')
      return
    }

    setLoading(true)
    setError('')

    const r = await fetchJson<{ ok: true }>('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_no: loginNo, pin }),
    })

    setLoading(false)

    if (!r.ok) {
      /* どちらが違うかは伝えない（総当たりの手掛かりになるため）。ロック中はその旨が返る */
      setError(r.json.error)
      setPin('')
      return
    }

    goHome()
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

          <label className="fa-label" htmlFor="pin">PIN（6桁）</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
            placeholder="••••••"
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

            {passkeySupported && (
              <>
                <p style={{ margin: '14px 0', textAlign: 'center', fontSize: 12, color: 'var(--fa-muted)' }}>
                  または
                </p>
                <button
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="fa-btn fa-btn--sky"
                  style={{ width: '100%' }}
                >
                  指紋・顔認証でログイン
                </button>
                <p style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.7, color: 'var(--fa-muted)' }}>
                  マイページの「設定」で、この端末を登録した方が使えます。
                </p>
              </>
            )}
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