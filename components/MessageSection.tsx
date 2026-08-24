/* components/MessageSection.tsx
 *
 * 献立への質問と、お気に入り登録。
 * 質問は週2回まで。判定はサーバー側で行うが、
 * 画面にも残り回数を出して、書いてから弾かれることのないようにする。
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGuardian } from '@/lib/useGuardian'
import { WEEKLY_LIMIT, SCHOOL_TEL, nextMondayLabel } from '@/lib/questionLimit'

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
  const [remaining, setRemaining] = useState<number | null>(null)

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

  /* ---------------- 残り回数 ---------------- */

  const fetchRemaining = useCallback(async () => {
    if (!guardian) return
    const res = await fetch('/api/questions')
    const json = await res.json()
    if (res.ok) setRemaining(json.remaining)
  }, [guardian])

  useEffect(() => { fetchRemaining() }, [fetchRemaining])

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

    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_id: menuId, body: newMessage.trim() }),
    })
    const json = await res.json()
    setSending(false)

    if (!res.ok) {
      setError(
        res.status === 429
          ? `今週はあと0回です。${nextMondayLabel()}（月曜）からまたお使いいただけます。`
          : '送信できませんでした。時間をおいてお試しください。'
      )
      if (typeof json.remaining === 'number') setRemaining(json.remaining)
      return
    }

    setNewMessage('')
    setRemaining(json.remaining)
    fetchMessages()
  }

  const canSend = remaining === null || remaining > 0

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
          {/* 回数の案内 */}
          <div className="fa-limitbox">
            <p className="fa-limittitle">
              質問は各ご家庭 週{WEEKLY_LIMIT}回まで
              {remaining !== null && (
                <span className={`fa-limitcount${remaining === 0 ? ' is-out' : ''}`}>
                  今週はあと{remaining}回
                </span>
              )}
            </p>
            <p className="fa-limittext">
              栄養士がお子さま一人ひとりのアレルギーや栄養バランスと真摯に向き合い、
              丁寧にお答えするため、回数を設けています。
            </p>
            <p className="fa-limittext" style={{ marginTop: 6 }}>
              アレルギーなど緊急性の高いご相談は、園まで直接ご連絡ください。
              <a href={`tel:${SCHOOL_TEL.replace(/-/g, '')}`} className="fa-tel">
                📞 {SCHOOL_TEL}
              </a>
            </p>
          </div>

          {canSend ? (
            <>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="質問や感想を書いてください"
                rows={3}
                maxLength={1000}
                className="fa-input fa-textarea"
                style={{ marginTop: 12 }}
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
            </>
          ) : (
            <p className="fa-empty" style={{ marginTop: 12 }}>
              今週はあと0回です。{nextMondayLabel()}（月曜）からまたお使いいただけます。
            </p>
          )}
        </div>
      ) : (
        <p className="fa-empty" style={{ marginTop: 16 }}>
          質問を送るにはログインが必要です。
        </p>
      )}
    </section>
  )
}