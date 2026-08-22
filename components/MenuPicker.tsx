/* components/MenuPicker.tsx
 *
 * 過去に投稿した献立を選んで、今日の献立として複製する。
 * 引き継ぐのは栄養価・アレルゲン・食材のみ。
 * 写真とコメント類はその日ごとに入れ直す。
 */
'use client'

import { useState, useMemo } from 'react'
import { formatDate, formatIngredients } from '@/lib/menu'
import { usedAllergens } from '@/lib/allergens'

type Props = {
  menus: any[]
  onPick: (menu: any) => void
}

export default function MenuPicker({ menus, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const k = keyword.trim()
    if (!k) return menus.slice(0, 30)
    return menus
      .filter(
        (m) =>
          m.title?.includes(k) ||
          formatIngredients(m.ingredients).includes(k)
      )
      .slice(0, 30)
  }, [menus, keyword])

  if (menus.length === 0) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fa-reusebtn"
      >
        <span className="fa-reuseicon">📋</span>
        <span>
          <span className="fa-reusetitle">過去の献立から選ぶ</span>
          <span className="fa-reusesub">
            栄養価とアレルギーをそのまま引き継げます
          </span>
        </span>
      </button>
    )
  }

  return (
    <section className="fa-card fa-reusepanel">
      <div className="fa-listhead">
        <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>
          過去の献立から選ぶ
        </h2>
        <button
          type="button"
          onClick={() => { setOpen(false); setKeyword('') }}
          className="fa-btn fa-btn--ghost"
          style={{ flex: '0 0 auto', padding: '7px 14px', fontSize: 12 }}
        >
          閉じる
        </button>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="献立名・食材で探す"
        className="fa-input"
        style={{ marginBottom: 12 }}
      />

      {filtered.length === 0 ? (
        <p className="fa-empty">見つかりませんでした。</p>
      ) : (
        <div className="fa-reuselist">
          {filtered.map((m) => {
            const used = usedAllergens(m.allergens)
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => { onPick(m); setOpen(false); setKeyword('') }}
                className="fa-reuseitem"
              >
                <span className="fa-reuseitem-main">
                  <span className="fa-date">{formatDate(m.served_date)}</span>
                  <span className="fa-reuseitem-title">{m.title}</span>
                  <span className="fa-reuseitem-meta">
                    {m.kcal ? `${m.kcal}kcal` : '栄養価なし'}
                    {used.length > 0 && `　${used.map((a) => a.label).join('・')}`}
                    {m.allergen_checked && used.length === 0 && '　アレルゲン該当なし'}
                  </span>
                </span>
                <span className="fa-reuseitem-arrow">複製 →</span>
              </button>
            )
          })}
        </div>
      )}

      {!keyword && menus.length > 30 && (
        <p className="fa-note" style={{ marginTop: 10 }}>
          最近の30件を表示しています。古い献立は検索してください。
        </p>
      )}
    </section>
  )
}