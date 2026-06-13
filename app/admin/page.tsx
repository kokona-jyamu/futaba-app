'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [messages, setMessages] = useState<{id: string, body: string, sender_name: string, is_nutritionist: boolean, menu_id: string}[]>([])
  const [replyBody, setReplyBody] = useState<{[key: string]: string}>({})
  const [activeTab, setActiveTab] = useState<'post' | 'messages'>('post')

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
    allergens: {
      egg: false, milk: false, wheat: false, buckwheat: false,
      peanut: false, shrimp: false, crab: false, walnut: false,
    }
  })

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, menus(title, served_date)')
        .eq('is_nutritionist', false)
        .order('created_at', { ascending: false })
      if (data) setMessages(data)
    }
    fetchMessages()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null
    const ext = photoFile.name.split('.').pop()
    const fileName = `${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('menu-photos')
      .upload(fileName, photoFile)
    if (error) {
      setMessage('写真のアップロードに失敗しました：' + error.message)
      return null
    }
    const { data } = supabase.storage
      .from('menu-photos')
      .getPublicUrl(fileName)
    return data.publicUrl
  }

  const toggleAllergen = (key: string) => {
    setForm({
      ...form,
      allergens: { ...form.allergens, [key]: !form.allergens[key as keyof typeof form.allergens] }
    })
  }

  const handleReply = async (menuId: string, messageId: string) => {
    const body = replyBody[messageId]
    if (!body?.trim()) return

    await supabase.from('messages').insert({
      menu_id: menuId,
      body: body.trim(),
      sender_name: '栄養士',
      is_nutritionist: true,
      is_public: true,
    })

    setReplyBody({ ...replyBody, [messageId]: '' })

    const { data } = await supabase
      .from('messages')
      .select('*, menus(title, served_date)')
      .eq('is_nutritionist', false)
      .order('created_at', { ascending: false })
    if (data) setMessages(data)
  }

  const handleSubmit = async () => {
    if (!form.served_date || !form.title) {
      setMessage('日付と献立名は必須です')
      return
    }

    setLoading(true)
    setMessage('')

    const photoUrl = await uploadPhoto()

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
      allergens: form.allergens,
      photo_url: photoUrl,
    })

    setLoading(false)

    if (error) {
      setMessage('エラー：' + error.message)
    } else {
      setMessage('投稿しました！')
      setPhotoFile(null)
      setPhotoPreview(null)
      setForm({
        served_date: '', title: '', nutritionist_comment: '',
        why_eat_note: '', kcal: '', carb: '', protein: '',
        fat: '', salt: '', calcium: '',
        allergens: {
          egg: false, milk: false, wheat: false, buckwheat: false,
          peanut: false, shrimp: false, crab: false, walnut: false,
        }
      })
      setTimeout(() => router.push('/'), 1000)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px',
    border: '1px solid #e0e0e0', borderRadius: '8px',
    marginTop: '4px', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: 500, color: '#555',
    marginTop: '12px', display: 'block'
  }

  return (
    <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem 1rem 4rem' }}>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('post')}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
            backgroundColor: activeTab === 'post' ? '#085041' : '#f0f0f0',
            color: activeTab === 'post' ? '#fff' : '#555',
            fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
          }}
        >
          📝 献立を投稿
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
            backgroundColor: activeTab === 'messages' ? '#085041' : '#f0f0f0',
            color: activeTab === 'messages' ? '#fff' : '#555',
            fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
          }}
        >
          💬 質問に返信
        </button>
      </div>

      {/* 投稿タブ */}
      {activeTab === 'post' && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#085041' }}>
              🌿 献立を投稿する
            </h1>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>栄養士専用画面</p>
          </div>

          <label style={labelStyle}>日付 *</label>
          <input
            type="date" name="served_date" value={form.served_date}
            onChange={handleChange}
            style={{ ...inputStyle, width: '100%', maxWidth: '100%', WebkitAppearance: 'none', appearance: 'none', display: 'block' }}
          />

          <label style={labelStyle}>献立名 *</label>
          <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="例：さばの味噌煮定食" style={inputStyle} />

          <label style={labelStyle}>写真</label>
          <div
            style={{ border: '2px dashed #e0e0e0', borderRadius: '12px', padding: '16px', textAlign: 'center', marginTop: '4px', backgroundColor: '#fafafa', cursor: 'pointer' }}
            onClick={() => document.getElementById('photo-input')?.click()}
          >
            {photoPreview ? (
              <img src={photoPreview} alt="プレビュー" style={{ width: '100%', borderRadius: '8px', objectFit: 'cover', maxHeight: '200px' }} />
            ) : (
              <div>
                <p style={{ fontSize: '24px', marginBottom: '6px' }}>📷</p>
                <p style={{ fontSize: '13px', color: '#888' }}>タップして写真を選ぶ</p>
                <p style={{ fontSize: '11px', color: '#bbb', marginTop: '2px' }}>JPG・PNG対応</p>
              </div>
            )}
          </div>
          <input id="photo-input" type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />

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
                    value={form[f.name as keyof typeof form] as string}
                    onChange={handleChange}
                    placeholder="0"
                    style={{ ...inputStyle, marginTop: '2px' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff8f0', borderRadius: '10px' }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#BA7517', marginBottom: '10px' }}>
              ⚠️ アレルギー（タップでON/OFF）
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { key: 'egg',       label: '卵',     emoji: '🥚' },
                { key: 'milk',      label: '乳',     emoji: '🥛' },
                { key: 'wheat',     label: '小麦',   emoji: '🌾' },
                { key: 'buckwheat', label: 'そば',   emoji: '🍜' },
                { key: 'peanut',    label: '落花生', emoji: '🥜' },
                { key: 'shrimp',    label: 'えび',   emoji: '🦐' },
                { key: 'crab',      label: 'かに',   emoji: '🦀' },
                { key: 'walnut',    label: 'くるみ', emoji: '🌰' },
              ].map(a => {
                const active = form.allergens[a.key as keyof typeof form.allergens]
                return (
                  <div
                    key={a.key}
                    onClick={() => toggleAllergen(a.key)}
                    style={{
                      width: '52px', height: '52px', borderRadius: '50%',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: active ? '#FFF0E6' : '#f0f0f0',
                      border: `2px solid ${active ? '#BA7517' : '#e0e0e0'}`,
                      opacity: active ? 1 : 0.4,
                      cursor: 'pointer', transition: 'all .15s',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{a.emoji}</span>
                    <span style={{ fontSize: '9px', color: active ? '#BA7517' : '#999', fontWeight: active ? 'bold' : 'normal' }}>
                      {a.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

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
        </>
      )}

      {/* 返信タブ */}
      {activeTab === 'messages' && (
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#085041', marginBottom: '16px' }}>
            💬 保護者からの質問
          </h2>

          {messages.length === 0 && (
            <p style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '20px' }}>
              まだ質問はありません
            </p>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{
              border: '1px solid #e0e0e0', borderRadius: '12px',
              padding: '14px', marginBottom: '12px', backgroundColor: '#fff',
            }}>
              <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                {(msg as any).menus?.served_date}　{(msg as any).menus?.title}
              </p>
              <div style={{
                backgroundColor: '#E6F1FB', borderRadius: '8px',
                padding: '10px 12px', marginBottom: '10px',
              }}>
                <p style={{ fontSize: '11px', color: '#378ADD', marginBottom: '4px' }}>
                  👤 {msg.sender_name}
                </p>
                <p style={{ fontSize: '13px', color: '#0C447C', lineHeight: '1.6' }}>
                  {msg.body}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea
                  value={replyBody[msg.id] || ''}
                  onChange={e => setReplyBody({ ...replyBody, [msg.id]: e.target.value })}
                  placeholder="返信を入力..."
                  rows={2}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: '13px',
                    border: '1px solid #e0e0e0', borderRadius: '8px',
                    resize: 'none', outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleReply(msg.menu_id, msg.id)}
                  disabled={!replyBody[msg.id]?.trim()}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: !replyBody[msg.id]?.trim() ? '#ccc' : '#085041',
                    color: '#fff', border: 'none', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 'bold',
                    cursor: !replyBody[msg.id]?.trim() ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  返信
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </main>
  )
}