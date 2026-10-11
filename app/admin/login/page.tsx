/* app/admin/login/page.tsx — 職員（栄養士・園管理者）のログイン
 *
 * 1. メールアドレスとパスワード
 * 2. 初回のみ：認証アプリ（Google Authenticator など）の登録（QR コードを読み取る）
 * 3. 認証アプリに表示される6桁の確認コード
 * 確認コードまで済まないと、管理画面にも職員用の API にも入れない（proxy.ts・lib/auth.ts で確かめる）。
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isStaffRole } from '@/lib/roles'
import { useLoadEffect } from '@/lib/useLoadEffect'
import AdminImg from '@/components/AdminImg'

type Step = 'loading' | 'password' | 'enroll' | 'verify' | 'done'

type State = { step: Step; factorId?: string; error?: string }

/** いまのログイン状態から、次に進む手順を決める */
async function nextState(): Promise<State> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { step: 'password' }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', session.user.id).maybeSingle()
  if (!profile || !isStaffRole(profile.role)) {
    await supabase.auth.signOut()
    return { step: 'password', error: 'この画面は管理者（栄養士）専用です' }
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel === 'aal2') return { step: 'done' }

  /* 登録済みの認証アプリがあれば確認コードへ、なければ登録へ */
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verified = factors?.totp?.[0]
  return verified ? { step: 'verify', factorId: verified.id } : { step: 'enroll' }
}

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#3aa876]'
const buttonClass =
  'w-full rounded-full bg-[#3aa876] text-white py-2.5 font-bold disabled:opacity-50'

export default function AdminLoginPage() {
  const router = useRouter()
  const [state, setState] = useState<State>({ step: 'loading' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [enrollment, setEnrollment] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /* ---------------- 2. 認証アプリの登録 ---------------- */

  async function startEnroll() {
    /* 途中でやめた登録が残っていると新しく登録できないので、先に消す */
    const { data: factors } = await supabase.auth.mfa.listFactors()
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `ふたば管理画面 ${new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
    })
    if (error || !data) {
      setError('認証アプリの登録を始められませんでした。時間をおいてやり直してください。')
      return
    }
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  /** 状態を画面に反映する。登録が必要なら QR コードを用意する */
  const apply = async (s: State) => {
    if (s.step === 'done') {
      router.replace('/admin')
      router.refresh()
      return
    }
    setState(s)
    if (s.error) setError(s.error)
    if (s.step === 'enroll') await startEnroll()
  }

  /* 確認コードの前に管理画面から戻されてきた場合も、続きの手順から始める */
  useLoadEffect(nextState, apply)

  /* ---------------- 1. パスワード ---------------- */

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError('メールアドレスまたはパスワードが正しくありません'); return }
    setPassword('')
    await apply(await nextState())
  }

  /* ---------------- 3. 確認コード ---------------- */

  async function handleCode(e: React.FormEvent) {
    e.preventDefault()
    const factorId = state.step === 'enroll' ? enrollment?.factorId : state.factorId
    if (!factorId) return
    if (!/^\d{6}$/.test(code)) { setError('認証アプリに表示されている6桁の数字を入力してください'); return }

    setLoading(true); setError(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setLoading(false)
    setCode('')
    if (error) { setError('確認コードが違うか、時間が過ぎています。新しいコードを入力してください'); return }
    await apply({ step: 'done' })
  }

  async function switchAccount() {
    await supabase.auth.signOut()
    setEnrollment(null); setError(null); setCode('')
    setState({ step: 'password' })
  }

  /* ---------------- 描画 ---------------- */

  const codeInput = (
    <div className="space-y-1">
      <label className="text-sm font-medium">確認コード（6桁）</label>
      <input
        type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className={`${inputClass} tracking-[.4em]`}
        autoFocus
      />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef4f1] p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-8 space-y-5">
        <h1 className="text-xl font-bold text-[#256b4c]">管理者ログイン</h1>

        {state.step === 'loading' && <p className="text-sm text-gray-500">読み込んでいます…</p>}

        {state.step === 'password' && (
          <form onSubmit={handlePassword} className="space-y-5">
            <p className="text-sm text-gray-500">栄養士・園管理者の方はこちら</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">メールアドレス</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="username" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">パスワード</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" className={inputClass} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? 'ログイン中…' : '次へ'}
            </button>
          </form>
        )}

        {state.step === 'enroll' && (
          <form onSubmit={handleCode} className="space-y-4">
            <p className="text-sm font-bold">2段階認証の登録（はじめの1回だけ）</p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal pl-5">
              <li>スマホに認証アプリ（Google Authenticator、Microsoft Authenticator など）を入れる</li>
              <li>アプリで下の QR コードを読み取る</li>
              <li>アプリに表示された6桁の数字を入力する</li>
            </ol>
            {enrollment ? (
              <>
                <AdminImg src={enrollment.qr} alt="認証アプリで読み取る QR コード" className="mx-auto w-48 h-48" />
                <p className="text-xs text-gray-500 break-all">
                  読み取れないときは、アプリに次の文字を入力してください：<br />
                  <span className="font-mono">{enrollment.secret}</span>
                </p>
                {codeInput}
              </>
            ) : (
              <p className="text-sm text-gray-500">準備しています…</p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading || !enrollment} className={buttonClass}>
              {loading ? '確認中…' : '登録してログイン'}
            </button>
            <button type="button" onClick={switchAccount} className="w-full text-sm text-gray-500">
              別のアカウントでログインする
            </button>
          </form>
        )}

        {state.step === 'verify' && (
          <form onSubmit={handleCode} className="space-y-4">
            <p className="text-sm text-gray-600">
              認証アプリに表示されている6桁の数字を入力してください。
            </p>
            {codeInput}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? '確認中…' : 'ログイン'}
            </button>
            <p className="text-xs text-gray-500">
              スマホをなくした・機種変更した場合は、運営（システムの管理者）に2段階認証の解除をお申し出ください。
            </p>
            <button type="button" onClick={switchAccount} className="w-full text-sm text-gray-500">
              別のアカウントでログインする
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
