'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    served_date: '',
    title: '',
    nutritionist_comment: '',
    why_eat_note: '',
    kcal: '',
    carb: '',
    protein: '',
    fat: '',
    salt: '',
    calcium: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.served_date || !form.title) {
      setMessage('日付と献立名は必須です')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.from('menus').insert({
      school_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      served_date: form.served_date,
      title: form.title,
      nutritionist_comment: form.nutritionist_comment,
      why_eat_note: form.why_eat_note,
      kcal:     form.kcal     ? parseFloat(form.kcal)     : null,
      carb:     form.carb     ? parseFloat(form.carb)     : null,
      protein:  form.protein  ? parseFloat(form.protein)  : null,
      fat:      form.fat      ? parseFloat(form.fat)      : null,
      salt:     form.salt     ? parseFloat(form.salt)     : null,
      calcium:  form.calcium  ? parseFloat(form.calcium)  : null,
    })

    setLoading(false)

    if (error) {
      setMessage('エラー：' + error.message)
    } else {
      setMessage('投稿しました！')
      setForm({
        served_date: '', title: '', nutritionist_comment: '',
        why_eat_note: '', kcal: '', carb: '', protein: '',
        fat: '', salt: '', calcium: '',
      })
      setTimeout(() => router.push('/'), 1000)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: '14px',
    border: '1px solid #e0e0e0', borderRadius: '8px',
    marginTop: '4px', outline: 'none',
  }
  const labelStyle = { fontSize: '12px', fontWeight: '500' as const, color: '#555', marginTop: '12px', display: 'block' as const }

  return (
    <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem 1rem 4rem' }}>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#085041' }}>
          🌿 献立を投稿する
        </h1>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>栄養士専用画面</p>
      </div>

      {/* 基本情報 */}
      <label style={labelStyle}>日付 *</label>
      <input type="date" name="served_date" value={form.served_date} onChange={handleChange} style={inputStyle} />

      <label style={labelStyle}>献立名 *</label>
      <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="例：さばの味噌煮定食" style={inputStyle} />

      {/* 栄養価 */}
      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f7f4', borderRadius: '10px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#085041', marginBottom: '8px' }}>栄養価</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'エネルギー (kcal)', name: 'kcal' },
            { label: '炭水化物 (g)',       name: 'carb' },
            { label: 'タンパク質 (g)',     name: 'protein' },
            { label: '脂質 (g)',           name: 'fat' },
            { label: '食塩相当量 (g)',     name: 'salt' },
            { label: 'カルシウム (mg)',    name: 'calcium' },
          ].map(f => (
            <div key={f.name}>
              <label style={{ fontSize: '11px', color: '#555' }}>{f.label}</label>
              <input
                type="number" name={f.name}
                value={form[f.name as keyof typeof form]}
                onChange={handleChange}
                placeholder="0"
                style={{ ...inputStyle, marginTop: '2px' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* コメント */}
      <label style={labelStyle}>栄養士コメント</label>
      <textarea
        name="nutritionist_comment" value={form.nutritionist_comment}
        onChange={handleChange} placeholder="今日の給食のポイントを書いてください"
        rows={3} style={{ ...inputStyle, resize: 'vertical' }}
      />

      <label style={labelStyle}>今日の食べっぷり</label>
      <textarea
        name="why_eat_note" value={form.why_eat_note}
        onChange={handleChange} placeholder="子どもたちの様子を書いてください"
        rows={3} style={{ ...inputStyle, resize: 'vertical' }}
      />

      {/* 送信ボタン */}
      {message && (
        <p style={{ marginTop: '12px', fontSize: '13px', color: message.startsWith('エラー') ? '#c00' : '#085041' }}>
          {message}
        </p>
      )}

      <button
        onClick={handleSubmit} disabled={loading}
        style={{
          marginTop: '20px', width: '100%', padding: '14px',
          backgroundColor: loading ? '#ccc' : '#085041',
          color: '#fff', fontSize: '15px', fontWeight: 'bold',
          border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '投稿中...' : '投稿する'}
      </button>

    </main>
  )
}