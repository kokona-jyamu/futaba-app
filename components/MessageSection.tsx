/* components/MessageSection.tsx
 *
 * 献立への質問と、お気に入り登録。
 * RLS 対応のため、質問には必ず guardian_id を入れる。
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGuardian } from '@/lib/useGuardian'

type Message = {
  id: string
  body: string
  sender_name: string
  is_nutritionist: boolean
  created_at: string
  guardian_id: string | null
}

export default function MessageSection({ menuId }: { menuId: string }) {
  const { guardian, child } = useGuardian()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)

  /* ---------------- 質問の取得 ---------------- */

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('menu_id', menuId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }, [menuId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  /* ---------------- お気に入り ---------------- */

  useEffect(() => {
    if (!guardian) return
    const check = async () => {
      const { data } = await supabase
        .from('favorites')
        .select('menu_id')
        .eq('guardian_id', guardian.id)
        .eq('menu_id', menuId)
        .maybeSingle()
      setIsFavorite(!!data)
    }
    check()
  }, [guardian, menuId])

  const toggleFavorite = async () => {
    if (!guardian) return
    const next = !isFavorite
    setIsFavorite(next)

    const { error: favError } = next
      ? await supabase.from('favorites')
          .insert({ guardian_id: guardian.id, menu_id: menuId })
      : await supabase.from('favorites')
          .delete()
          .eq('guardian_id', guardian.id)
          .eq('menu_id', menuId)

    if (favError) setIsFavorite(!next)
  }

  /* ---------------- 送信 ---------------- */

  const handleSend = async () => {
    if (!newMessage.trim() || !guardian) return

    setSending(true)
    setError('')

    const { error: sendError } = await supabase.from('messages').insert({
      menu_id: menuId,
      body: newMessage.trim(),
      /* 誰から届いたか分かるようにする。栄養士側の一覧に出る名前 */
      sender_name: child?.name ? `${child.name}の保護者` : '保護者',
      guardian_id: guardian.id,
      is_nutritionist: false,
      is_public: true,
    })

    setSending(false)

    if (sendError) {
      setError('送信できませんでした。時間をおいてお試しください。')
      return
    }

    setNewMessage('')
    fetchMessages()
  }

  return (
    <section style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--fa-line)' }}>

      {/* お気に入り */}
      {guardian && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={toggleFavorite}
            className={`fa-fav${isFavorite ? ' is-on' : ''}`}
            aria-pressed={isFavorite}
          >
            <span className="fa-fav-icon">{isFavorite ? '⭐' : '☆'}</span>
            {isFavorite ? 'お気に入りに登録ずみ' : 'お気に入りに登録する'}
          </button>
        </div>
      )}

      <h2 className="fa-sectiontitle">💬 栄養士さんに聞いてみる</h2>

      {messages.length > 0 && (
        <div className="fa-thread">
          {messages.map((msg) => {
            const mine = !!guardian && msg.guardian_id === guardian.id
            return (
              <div
                key={msg.id}
                className={`fa-msg${msg.is_nutritionist ? ' fa-msg--staff' : mine ? ' fa-msg--mine' : ''}`}
              >
                <p className="fa-sender">
                  {msg.is_nutritionist
                    ? `🌿 ${msg.sender_name}`
                    : mine
                      ? 'わたしの質問'
                      : `👤 ${msg.sender_name}`}
                </p>
                <p className="fa-body">{msg.body}</p>
              </div>
            )
          })}
        </div>
      )}

      {guardian ? (
        <div style={{ marginTop: 16 }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="質問や感想を書いてください"
            rows={3}
            className="fa-input fa-textarea"
          />

          {error && (
            <p className="fa-toast is-error" style={{ marginTop: 10, marginBottom: 0 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="fa-btn fa-btn--primary"
            style={{ width: '100%', marginTop: 10 }}
          >
            {sending ? '送信中…' : '送信する'}
          </button>

          <p className="fa-note" style={{ marginTop: 10 }}>
            送った質問と栄養士さんからの返信は、マイページの「しつもん」からも確認できます。
          </p>
        </div>
      ) : (
        <p className="fa-empty" style={{ marginTop: 16 }}>
          質問を送るにはログインが必要です。
        </p>
      )}
    </section>
  )
}