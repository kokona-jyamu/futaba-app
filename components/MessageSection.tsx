'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Message = {
  id: string
  body: string
  sender_name: string
  is_nutritionist: boolean
  created_at: string
}

type Props = {
  menuId: string
}

export default function MessageSection({ menuId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [senderName, setSenderName] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('menu_id', menuId)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    fetchMessages()
  }, [menuId])

  const handleSend = async () => {
    if (!body.trim()) return
    setSending(true)

    const { error } = await supabase.from('messages').insert({
      menu_id: menuId,
      body: body.trim(),
      sender_name: senderName.trim() || '保護者',
      is_nutritionist: false,
      is_public: true,
    })

    setSending(false)
    if (!error) {
      setBody('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('menu_id', menuId)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
  }

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', marginBottom: '32px' }}>
      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
        💬 栄養士への質問・コメント
      </p>

      {/* メッセージ一覧 */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.is_nutritionist ? 'flex-start' : 'flex-end',
              }}
            >
              <span style={{ fontSize: '10px', color: '#999', marginBottom: '2px' }}>
                {msg.is_nutritionist ? '🌿 栄養士より' : `👤 ${msg.sender_name}`}
              </span>
              <div style={{
                padding: '10px 12px',
                borderRadius: '12px',
                borderBottomLeftRadius: msg.is_nutritionist ? '4px' : '12px',
                borderBottomRightRadius: msg.is_nutritionist ? '12px' : '4px',
                backgroundColor: msg.is_nutritionist ? '#E1F5EE' : '#E6F1FB',
                color: msg.is_nutritionist ? '#085041' : '#0C447C',
                fontSize: '13px',
                lineHeight: '1.6',
                maxWidth: '85%',
              }}>
                {msg.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && (
        <p style={{ fontSize: '12px', color: '#bbb', marginBottom: '14px', textAlign: 'center' }}>
          まだコメントはありません。気軽に質問してください！
        </p>
      )}

      {/* 入力フォーム */}
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
        <input
          type="text"
          value={senderName}
          onChange={e => setSenderName(e.target.value)}
          placeholder="お名前（任意）"
          style={{
            width: '100%', padding: '8px 12px', fontSize: '13px',
            border: '1px solid #e0e0e0', borderRadius: '8px',
            marginBottom: '8px', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="質問やコメントを入力..."
            rows={2}
            style={{
              flex: 1, padding: '8px 12px', fontSize: '13px',
              border: '1px solid #e0e0e0', borderRadius: '8px',
              resize: 'none', outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            style={{
              padding: '10px 14px',
              backgroundColor: sending || !body.trim() ? '#ccc' : '#085041',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 'bold',
              cursor: sending || !body.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {sending ? '送信中' : '送信'}
          </button>
        </div>
        {sent && (
          <p style={{ fontSize: '12px', color: '#1D9E75', marginTop: '8px' }}>
            ✓ 送信しました！栄養士からの返信をお待ちください。
          </p>
        )}
      </div>
    </div>
  )
}