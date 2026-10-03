/* components/MessageSection.tsx
 *
 * 献立への質問と、お気に入り登録。
 * 質問は週2回まで。判定はサーバー側で行うが、
 * 画面にも残り回数を出して、書いてから弾かれることのないようにする。
 *
 * 表示するのは自分が送った質問と、それへの返信だけ。
 * ほかの家庭の質問は送信者名から園児が分かるため見せない。
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGuardian } from '@/lib/useGuardian'
import { WEEKLY_LIMIT, SCHOOL_TEL, nextMondayLabel } from '@/lib/questionLimit'

type Reply = {
  id: string
  body: string
  sender_name: string
  created_at: string
}

type Question = {
  id: string
  body: string
  created_at: string
  replies: Reply[]
}

export default function MessageSection({ menuId }: { menuId: string }) {
  const { guardian } = useGuardian()
  const [questions, setQuestions] = useState<Question[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  /* ---------------- 自分の質問と残り回数の取得 ---------------- */

  const fetchQuestions = useCallback(async () => {
    if (!guardian) return
    const res = await fetch(`/api/questions?menu_id=${encodeURIComponent(menuId)}`)
    const json = await res.json()
    if (!res.ok) return
    setRemaining(json.remaining)
    /* API は新しい順なので、会話として読めるよう古い順に並べ直す */
    setQuestions([...json.questions].reverse())
  }, [guardian, menuId])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

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
    fetchQuestions()
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

      {questions.length > 0 && (
        <div className="fa-thread">
          {questions.flatMap((q) => [
            <div key={q.id} className="fa-msg fa-msg--mine">
              <p className="fa-sender">わたしの質問</p>
              <p className="fa-body">{q.body}</p>
            </div>,
            ...q.replies.map((r) => (
              <div key={r.id} className="fa-msg fa-msg--staff">
                <p className="fa-sender">🌿 {r.sender_name}</p>
                <p className="fa-body">{r.body}</p>
              </div>
            )),
          ])}
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
                質問と返信は、ほかのご家庭には表示されません。
                マイページの「質問」からも確認できます。
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