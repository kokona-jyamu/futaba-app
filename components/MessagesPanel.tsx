/* components/MessagesPanel.tsx — 管理画面「質問に返信」タブ
 *
 * 未回答と回答済みを分けて表示する。
 * 返信すると自動的に回答済みへ移る。
 */
'use client'

import { useState, useMemo } from 'react'
import { formatDate } from '@/lib/menu'

type Reply = { id: string; body: string; created_at: string }
type Question = {
  id: string
  menu_id: string
  body: string
  sender_name: string
  created_at: string
  menus?: { title: string; served_date: string }
  replies: Reply[]
}

type Props = {
  messages: Question[]
  onReply: (menuId: string, questionId: string, body: string) => Promise<boolean>
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

export default function MessagesPanel({ messages, onReply }: Props) {
  const [box, setBox] = useState<'open' | 'done'>('open')
  const [replyBody, setReplyBody] = useState<{ [key: string]: string }>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)

  const { open, done } = useMemo(() => ({
    open: messages.filter((m) => m.replies.length === 0),
    done: messages.filter((m) => m.replies.length > 0),
  }), [messages])

  const shown = box === 'open' ? open : done

  const send = async (q: Question) => {
    const text = replyBody[q.id]
    if (!text?.trim()) return

    setReplyingId(q.id)
    const ok = await onReply(q.menu_id, q.id, text.trim())
    setReplyingId(null)

    if (ok) setReplyBody({ ...replyBody, [q.id]: '' })
  }

  return (
    <section>
      <div className="fa-tabs" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginTop: 0, marginBottom: 18 }}>
        <button
          className={`fa-tab${box === 'open' ? ' is-on' : ''}`}
          onClick={() => setBox('open')}
        >
          <span className="fa-tab-icon">📮</span>未回答
          {open.length > 0 && <span className="fa-badge">{open.length}</span>}
        </button>
        <button
          className={`fa-tab${box === 'done' ? ' is-on' : ''}`}
          onClick={() => setBox('done')}
        >
          <span className="fa-tab-icon">✓</span>回答済み
          {done.length > 0 && <span className="fa-badge">{done.length}</span>}
        </button>
      </div>

      {shown.length === 0 && (
        <p className="fa-empty">
          {box === 'open'
            ? open.length === 0 && done.length === 0
              ? 'まだ質問はありません。届くとここに並びます。'
              : 'すべての質問に返信しました。'
            : 'まだ返信した質問はありません。'}
        </p>
      )}

      <div className="fa-grid fa-grid--2">
        {shown.map((q) => (
          <article key={q.id} className="fa-card">
            <p className="fa-date">
              {formatDate(q.menus?.served_date)}　{q.menus?.title}
            </p>

            <div className="fa-bubble">
              <p className="fa-sender">
                👤 {q.sender_name}
                <span className="fa-msgtime">{formatDateTime(q.created_at)}</span>
              </p>
              <p className="fa-body">{q.body}</p>
            </div>

            {/* 送った返信 */}
            {q.replies.map((r) => (
              <div key={r.id} className="fa-bubble fa-bubble--reply">
                <p className="fa-sender">
                  🌿 返信済み
                  <span className="fa-msgtime">{formatDateTime(r.created_at)}</span>
                </p>
                <p className="fa-body">{r.body}</p>
              </div>
            ))}

            {/* 未回答なら入力欄、回答済みなら追記欄 */}
            <div className="fa-replyrow">
              <textarea
                value={replyBody[q.id] || ''}
                rows={2}
                onChange={(e) => setReplyBody({ ...replyBody, [q.id]: e.target.value })}
                placeholder={box === 'open' ? '返信を入力…' : '追加で伝えることがあれば…'}
                className="fa-input fa-textarea"
              />
              <button
                onClick={() => send(q)}
                disabled={!replyBody[q.id]?.trim() || replyingId === q.id}
                className="fa-btn fa-btn--primary fa-btn--send"
              >
                {replyingId === q.id ? '送信中…' : '返信する'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}