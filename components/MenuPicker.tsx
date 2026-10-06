/* components/MenuPicker.tsx
 *
 * 過去に投稿した献立を選んで、今日の献立として複製する。
 * 引き継ぐのは栄養価・アレルゲン・食材・料理（レシピも料理と一緒に引き継がれる）。
 * 写真とコメント類はその日ごとに入れ直す（料理の写真は「前回の写真を使う」で選べる）。
 *
 * 探し方：
 *  - 種類のタグ（主食・汁物・主菜・副菜 など）で、その種類の料理が入った献立に絞る
 *  - 検索語は、献立名・主な食材・料理名から探す。タグを選んでいるときは、その種類の料理名から探す
 */
'use client'

import { useState, useMemo } from 'react'
import { formatDate, formatIngredients } from '@/lib/menu'
import { usedAllergens } from '@/lib/allergens'
import { sortKinds, type PhotoKind } from '@/lib/menuPhotos'
import type { AdminMenu } from '@/lib/apiTypes'

type Props = {
  menus: AdminMenu[]
  /** 園の写真の種類（タグとして使う） */
  kinds: PhotoKind[]
  onPick: (menu: AdminMenu) => void
}

const SHOW_MAX = 30

export default function MenuPicker({ menus, kinds, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [kindId, setKindId] = useState<string | null>(null)

  /* 料理が1品でも入っている種類だけをタグとして出す */
  const tagKinds = useMemo(() => {
    const used = new Set(menus.flatMap((m) => m.menu_dishes.map((d) => d.dish.kind_id)))
    return sortKinds(kinds).filter((k) => used.has(k.id))
  }, [menus, kinds])

  const filtered = useMemo(() => {
    const k = keyword.trim()
    return menus.filter((m) => {
      const dishes = kindId ? m.menu_dishes.filter((d) => d.dish.kind_id === kindId) : m.menu_dishes
      if (kindId && dishes.length === 0) return false
      if (!k) return true
      /* タグを選んでいるときは、その種類の料理名から探す */
      if (kindId) return dishes.some((d) => d.dish.name.includes(k))
      return (
        !!m.title?.includes(k) ||
        formatIngredients(m.ingredients).includes(k) ||
        dishes.some((d) => d.dish.name.includes(k))
      )
    })
  }, [menus, keyword, kindId])

  if (menus.length === 0) return null

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="fa-reusebtn">
        <span className="fa-reuseicon">📋</span>
        <span>
          <span className="fa-reusetitle">過去の献立から選ぶ</span>
          <span className="fa-reusesub">
            料理・レシピ・栄養価・アレルギーをそのまま引き継げます
          </span>
        </span>
      </button>
    )
  }

  const close = () => { setOpen(false); setKeyword(''); setKindId(null) }
  const kindLabel = kinds.find((k) => k.id === kindId)?.label

  return (
    <section className="fa-card fa-reusepanel">
      <div className="fa-listhead">
        <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>過去の献立から選ぶ</h2>
        <button
          type="button"
          onClick={close}
          className="fa-btn fa-btn--ghost"
          style={{ flex: '0 0 auto', padding: '7px 14px', fontSize: 12 }}
        >
          閉じる
        </button>
      </div>

      {tagKinds.length > 0 && (
        <div className="fa-typerow" style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setKindId(null)}
            className={`fa-filterbtn${kindId === null ? ' is-on' : ''}`}
          >
            すべて
          </button>
          {tagKinds.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKindId(kindId === k.id ? null : k.id)}
              className={`fa-filterbtn${kindId === k.id ? ' is-on' : ''}`}
              aria-pressed={kindId === k.id}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={kindLabel ? `${kindLabel}の料理名で探す（例：さば）` : '献立名・料理名・食材で探す'}
        className="fa-input"
        style={{ marginBottom: 12 }}
      />

      {filtered.length === 0 ? (
        <p className="fa-empty">見つかりませんでした。</p>
      ) : (
        <div className="fa-reuselist">
          {filtered.slice(0, SHOW_MAX).map((m) => {
            const used = usedAllergens(m.allergens)
            const dishNames = m.menu_dishes
              .filter((d) => !kindId || d.dish.kind_id === kindId)
              .map((d) => d.dish.name)
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => { onPick(m); close() }}
                className="fa-reuseitem"
              >
                <span className="fa-reuseitem-main">
                  <span className="fa-date">{formatDate(m.served_date)}</span>
                  <span className="fa-reuseitem-title">{m.title}</span>
                  {dishNames.length > 0 && (
                    <span className="fa-reuseitem-meta">{dishNames.join('・')}</span>
                  )}
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

      {filtered.length > SHOW_MAX && (
        <p className="fa-note" style={{ marginTop: 10 }}>
          新しい順に{SHOW_MAX}件を表示しています。古い献立は、検索語やタグで絞り込んでください。
        </p>
      )}
    </section>
  )
}
