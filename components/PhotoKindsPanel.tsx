/* components/PhotoKindsPanel.tsx — 献立写真の「種類」の設定（管理画面「設定」タブ）
 *
 * 主食・汁物・主菜・副菜 などを園ごとに決める。
 * 「使う」にできる数には上限がある（標準 4）。増やすのは運営者が行う。
 * 過去の写真が消えないよう、削除はせず「使わない」にする。
 */
'use client'

import { useState } from 'react'
import { useLoadEffect, fetchJson } from '@/lib/useLoadEffect'
import { PHOTO_KIND_SUGGESTIONS, sortKinds, type PhotoKind } from '@/lib/menuPhotos'
import type { PhotoKindsResponse, PhotoKindResponse } from '@/lib/apiTypes'

const request = () => fetchJson<PhotoKindsResponse>('/api/admin/photo-kinds')

/** 種類を追加・変更する */
const send = (method: 'POST' | 'PATCH', body: Record<string, unknown>) =>
  fetchJson<PhotoKindResponse>('/api/admin/photo-kinds', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export default function PhotoKindsPanel({
  onNotify,
  onChange,
}: {
  onNotify: (msg: string, isError?: boolean) => void
  /** 種類を変えたあと（管理画面の写真の登録欄に反映するため） */
  onChange?: () => void
}) {
  const [kinds, setKinds] = useState<PhotoKind[]>([])
  const [limit, setLimit] = useState(4)
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = (r: Awaited<ReturnType<typeof request>>) => {
    if (!r.ok) { onNotify(r.json.error, true); return }
    setKinds(sortKinds(r.json.kinds))
    setLimit(r.json.limit)
  }
  useLoadEffect(request, apply)

  /** 変更のあとに一覧を取り直し、親にも知らせる */
  const reload = async () => {
    apply(await request())
    onChange?.()
  }

  const activeCount = kinds.filter((k) => k.is_active).length
  const full = activeCount >= limit
  const suggestions = PHOTO_KIND_SUGGESTIONS.filter((s) => !kinds.some((k) => k.label === s))

  /* ---------------- 追加 ---------------- */

  const add = async (label: string) => {
    if (!label.trim()) { onNotify('種類の名前を入力してください。', true); return }
    setSaving(true)
    const r = await send('POST', { label })
    setSaving(false)
    if (!r.ok) { onNotify(r.json.error, true); return }
    onNotify(`「${r.json.kind.label}」を追加しました。`)
    setNewLabel('')
    reload()
  }

  /* ---------------- 変更 ---------------- */

  const update = async (id: string, patch: Record<string, unknown>, done: string) => {
    setSaving(true)
    const r = await send('PATCH', { id, ...patch })
    setSaving(false)
    if (!r.ok) { onNotify(r.json.error, true); return false }
    onNotify(done)
    reload()
    return true
  }

  const saveLabel = async (k: PhotoKind) => {
    if (await update(k.id, { label: editingLabel }, '名前を変えました。')) setEditingId(null)
  }

  /** 1つ上・下と入れ替える。並び順は 10, 20, 30… に振り直す */
  const move = async (index: number, dir: -1 | 1) => {
    const next = [...kinds]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]

    setSaving(true)
    for (const [i, k] of next.entries()) {
      const order = (i + 1) * 10
      if (k.sort_order !== order) await send('PATCH', { id: k.id, sort_order: order })
    }
    setSaving(false)
    reload()
  }

  return (
    <section className="fa-card" style={{ marginBottom: 18 }}>
      <div className="fa-listhead">
        <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>献立の写真の種類</h2>
        <span className={`fa-countbadge${full ? ' is-full' : ''}`}>使用中 {activeCount} / {limit}</span>
      </div>
      <p className="fa-note" style={{ marginTop: 6 }}>
        献立には「お盆全体」の写真に加えて、ここで「使う」にした種類ごとに写真を入れられます。
        使わなくした種類でも、これまでに入れた写真は保護者の画面に残ります。
      </p>

      <div className="fa-attlist">
        {kinds.map((k, i) => (
          <div key={k.id} className="fa-attrow">
            {editingId === k.id ? (
              <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  maxLength={20}
                  className="fa-input fa-input--sm"
                  style={{ flex: 1, minWidth: 120 }}
                />
                <button onClick={() => saveLabel(k)} disabled={saving} className="fa-filterbtn">保存</button>
                <button onClick={() => setEditingId(null)} className="fa-filterbtn">やめる</button>
              </div>
            ) : (
              <>
                <span className="fa-childline-name" style={{ opacity: k.is_active ? 1 : 0.5 }}>
                  {k.label}
                  {!k.is_active && <span className="fa-attclass">使っていない</span>}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => move(i, -1)} disabled={saving || i === 0} className="fa-filterbtn" aria-label="上へ">▲</button>
                  <button onClick={() => move(i, 1)} disabled={saving || i === kinds.length - 1} className="fa-filterbtn" aria-label="下へ">▼</button>
                  <button
                    onClick={() => { setEditingId(k.id); setEditingLabel(k.label) }}
                    className="fa-filterbtn"
                  >
                    名前を変える
                  </button>
                  <button
                    onClick={() => update(
                      k.id,
                      { is_active: !k.is_active },
                      k.is_active ? `「${k.label}」を使わない設定にしました。` : `「${k.label}」を使う設定にしました。`
                    )}
                    disabled={saving || (!k.is_active && full)}
                    className={`fa-filterbtn${k.is_active ? ' is-on' : ''}`}
                  >
                    {k.is_active ? '使う' : '使わない'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {full ? (
        <p className="fa-note" style={{ marginTop: 12 }}>
          使える種類は{limit}つまでです。入れ替える場合は、どれかを「使わない」にしてから追加してください。
          枠を増やしたい場合は運営までお問い合わせください。
        </p>
      ) : (
        <div className="fa-tint fa-tint--green" style={{ marginTop: 14 }}>
          <label className="fa-label" style={{ marginTop: 0 }}>種類を追加する</label>
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => add(s)} disabled={saving} className="fa-filterbtn">
                  + {s}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              maxLength={20}
              placeholder="名前を入力（例：果物）"
              className="fa-input"
              style={{ flex: 1 }}
            />
            <button onClick={() => add(newLabel)} disabled={saving} className="fa-btn fa-btn--primary" style={{ flex: '0 0 auto' }}>
              追加
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
