'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/superbase'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      setError('メールアドレスまたはパスワードが正しくありません'); setLoading(false); return
    }
    const { data: profile } = await supabase
      .from('users').select('role, school_id').eq('id', data.user.id).single()
    if (!profile || !['nutritionist', 'admin'].includes(profile.role)) {
      await supabase.auth.signOut()
      setError('この画面は管理者（栄養士）専用です'); setLoading(false); return
    }
    router.replace('/admin'); router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef4f1] p-4">
      <form onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-8 space-y-5">
        <h1 className="text-xl font-bold text-[#256b4c]">管理者ログイン</h1>
        <p className="text-sm text-gray-500">栄養士・園管理者の方はこちら</p>
        <div className="space-y-1">
          <label className="text-sm font-medium">メールアドレス</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#3aa876]" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">パスワード</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#3aa876]" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-full bg-[#3aa876] text-white py-2.5 font-bold disabled:opacity-50">
          {loading ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}