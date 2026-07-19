'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (!id.trim() || !pass.trim()) {
      setError('IDとパスワードを入力してください')
      return
    }
    // デモ用：ID: futaba / PASS: 2026 でログイン
    if (id === 'futaba' && pass === '2026') {
      localStorage.setItem('futaba_logged_in', 'true')
      router.push('/')
    } else {
      setError('IDまたはパスワードが正しくありません')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', fontSize: '15px',
    border: '1px solid #e0e0e0', borderRadius: '10px',
    outline: 'none', backgroundColor: '#fafafa',
    marginBottom: '12px',
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f0f7f4',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: '360px',
        backgroundColor: '#fff', borderRadius: '20px',
        padding: '40px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* ロゴ */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🌱</div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#085041' }}>
            ふたば保育園
          </h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            給食・食育ポータル
          </p>
        </div>

        {/* フォーム */}
        <input
          type="text"
          placeholder="ID"
          value={id}
          onChange={e => setId(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="パスワード"
          value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={inputStyle}
        />

        {error && (
          <p style={{ fontSize: '13px', color: '#c00', marginBottom: '12px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: '100%', padding: '14px',
            backgroundColor: '#085041', color: '#fff',
            border: 'none', borderRadius: '10px',
            fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          ログイン
        </button>

        <p style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', marginTop: '16px' }}>
          ID・パスワードは園からお知らせします
        </p>
      </div>
    </main>
  )
}