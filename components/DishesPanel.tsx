/* components/DishesPanel.tsx — 料理の一覧（管理画面「料理」タブ）
 *
 * 園の料理（種類＝タグ・料理名・保護者向けのレシピ）を一覧で見て直す。
 *  - 種類のタグで絞る・料理名で探す・「最近出した順」「名前順」で並べる
 *  - 料理名・種類・レシピを直す（直すと、その料理を出したすべての日に反映される）
 *  - 献立に入れる前に、料理とレシピを先に登録しておける
 *  - 一度も献立に使っていない料理だけ削除できる（間違えて登録したものの片付け用）
 * 料理の一覧は管理画面の「料理を選ぶ欄」と共有している（親から受け取る）。
 */
'use client'

import { useMemo, useState } from 'react'
import AdminImg from '@/components/AdminImg'
import RecipeEditor from '@/components/RecipeEditor'
import { fetchJson } from '@/lib/useLoadEffect'
import { formatShort } from '@/lib/attendance'
import { sortKinds, type PhotoKind } from '@/lib/menuPhotos'
import type { DishSummary, DishResponse } from '@/lib/apiTypes'

type Props = {
  kinds: PhotoKind[]
  library: DishSummary[]
  onNotify: (msg: string, isError?: boolean) => void
  /** 料理を登録・変更・削除したあと（一覧を取り直すため） */
  onChange: () => void
}

type Sort = 'recent' | 'name'

export default function DishesPanel({ kinds, library, onNotify, onChange }: Props) {
  const [kindId, setKindId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [editingId, setEditingId] = useState<string | null>(null)

  /* 新しい料理の登録 */
  const [adding, setAdding] = useState(false)
  const [newKindId, setNewKindId] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const sortedKinds = useMemo(() => sortKinds(kinds), [kinds])
  const labelOf = useMemo(() => new Map(kinds.map((k) => [k.id, k.label])), [kinds])

  const shown = useMemo(() => {
    const k = keyword.trim()
    return library
      .filter((d) => !kindId || d.kind_id === kindId)
      .filter((d) => !k || d.name.includes(k))
      .sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name, 'ja')
          : (b.last_served_date ?? '').localeCompare(a.last_served_date ?? '') || a.name.localeCompare(b.name, 'ja')
      )
  }, [library, kindId, keyword, sort])

  /* ---------------- 登録 ---------------- */

  const startAdd = () => {
    setAdding(true)
    setNewName('')
    setNewKindId(kindId ?? sortedKinds.find((k) => k.is_active)?.id ?? '')
  }

  const add = async () => {
    if (!newName.trim()) { onNotify('料理名を入力してください。', true); return }
    setSaving(true)
    const r = await fetchJson<DishResponse>('/api/admin/dishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind_id: newKindId, name: newName }),
    })
    setSaving(false)
    if (!r.ok) { onNotify(r.json.error, true); return }

    onNotify(`「${r.json.dish.name}」を登録しました。続けてレシピを入れられます。`)
    setAdding(false)
    onChange()
    /* 登録した料理のレシピの欄を開いておく */
    setEditingId(r.json.dish.id)
  }

  /* ---------------- 削除 ---------------- */

  const remove = async (d: DishSummary) => {
    if (!confirm(`「${d.name}」を削除します。元に戻せません。`)) return
    const r = await fetchJson<{ ok: true }>('/api/admin/dishes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id }),
    })
    if (!r.ok) { onNotify(r.json.error, true); return }
    onNotify(`「${d.name}」を削除しました。`)
    onChange()
  }

  /* ---------------- 描画 ---------------- */

  return (
    <section>
      <div className="fa-listhead">
        <h2 className="fa-sectiontitle" style={{ marginBottom: 0 }}>
          料理<span className="fa-countbadge">{library.length}品</span>
        </h2>
        <button onClick={adding ? () => setAdding(false) : startAdd} className="fa-filterbtn">
          {adding ? '閉じる' : '＋ 料理を登録'}
        </button>
      </div>
      <p className="fa-note" style={{ marginBottom: 12 }}>
        料理名・種類・レシピを直すと、その料理を出したすべての日に反映されます。
        献立に使った料理は、過去の献立から消えないよう削除できません。
      </p>

      {adding && (
        <div className="fa-tint fa-tint--green" style={{ marginBottom: 16 }}>
          <label className="fa-label" style={{ marginTop: 0 }}>種類</label>
          <select value={newKindId} onChange={(e) => setNewKindId(e.target.value)} className="fa-input">
            {sortedKinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}{k.is_active ? '' : '（使っていない種類）'}
              </option>
            ))}
          </select>
          <label className="fa-label">料理名</label>
          <input
            type="text" value={newName} maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例：さばの味噌煮"
            className="fa-input"
          />
          <div className="fa-btnrow">
            <button onClick={add} disabled={saving} className="fa-btn fa-btn--primary">
              {saving ? '登録中…' : '登録する'}
            </button>
          </div>
        </div>
      )}

      {/* 絞り込み */}
      <div className="fa-typerow" style={{ marginBottom: 10 }}>
        <button
          onClick={() => setKindId(null)}
          className={`fa-filterbtn${kindId === null ? ' is-on' : ''}`}
        >
          すべて
        </button>
        {sortedKinds.map((k) => (
          <button
            key={k.id}
            onClick={() => setKindId(kindId === k.id ? null : k.id)}
            className={`fa-filterbtn${kindId === k.id ? ' is-on' : ''}`}
            aria-pressed={kindId === k.id}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="fa-dishfilters">
        <input
          type="search" value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="料理名で探す（例：さば）"
          className="fa-input"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="fa-input" aria-label="並び順">
          <option value="recent">最近出した順</option>
          <option value="name">名前順</option>
        </select>
      </div>

      {shown.length === 0 && (
        <p className="fa-empty">
          {library.length === 0 ? 'まだ料理が登録されていません。' : '該当する料理がありません。'}
        </p>
      )}

      <div className="fa-dishlist">
        {shown.map((d) => (
          <div key={d.id} className="fa-dishrow">
            <div className="fa-dishrow-main">
              {d.last_photo_url ? (
                <AdminImg src={d.last_photo_url} alt="" className="fa-dishrow-photo" />
              ) : (
                <div className="fa-dishrow-photo is-empty">写真なし</div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="fa-dishrow-name">{d.name}</p>
                <div className="fa-tagrow" style={{ marginTop: 4 }}>
                  <span className="fa-tag fa-tag--plain">{labelOf.get(d.kind_id) ?? '種類なし'}</span>
                  {d.has_recipe
                    ? <span className="fa-tag fa-tag--none">レシピあり</span>
                    : <span className="fa-tag fa-tag--unknown">レシピなし</span>}
                </div>
                <p className="fa-dishrow-meta">
                  {d.last_served_date
                    ? `${d.times_served}回　前回 ${formatShort(d.last_served_date)}`
                    : 'まだ献立に使っていない'}
                </p>
              </div>
              <div className="fa-dishrow-actions">
                <button
                  onClick={() => setEditingId(editingId === d.id ? null : d.id)}
                  className={`fa-filterbtn${editingId === d.id ? ' is-on' : ''}`}
                >
                  {editingId === d.id ? '閉じる' : '編集'}
                </button>
                {d.times_served === 0 && (
                  <button onClick={() => remove(d)} className="fa-filterbtn">削除</button>
                )}
              </div>
            </div>

            {editingId === d.id && (
              <RecipeEditor
                dishId={d.id}
                kinds={kinds}
                onNotify={onNotify}
                onClose={() => setEditingId(null)}
                onSaved={() => onChange()}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
