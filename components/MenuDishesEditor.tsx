/* components/MenuDishesEditor.tsx — 献立の料理と写真の登録欄（管理画面）
 *
 * 「お盆全体」の写真と、種類（主食・汁物・主菜・副菜 など）ごとの料理を登録する。
 *  - 料理は園の料理の一覧から料理名で探して選ぶ。見つからなければ新しい料理として登録する
 *  - 1つの種類に何品でも入れられる（副菜2品など）
 *  - 写真はその日のもの。前回同じ料理を出したときの写真を「前回の写真を使う」で選べる
 *  - レシピは料理に付く（直すと、その料理を出したすべての日に反映される）
 * 写真は選んだ時点でアップロードし、保存は親の「公開」「保存」ボタンで行う。
 */
'use client'

import { useState } from 'react'
import AdminImg from '@/components/AdminImg'
import RecipeEditor from '@/components/RecipeEditor'
import { fetchJson } from '@/lib/useLoadEffect'
import { formatShort } from '@/lib/attendance'
import { sortKinds, type PhotoKind } from '@/lib/menuPhotos'
import type { DishSummary, DishResponse, MenuDish } from '@/lib/apiTypes'

/** 編集中の「献立の料理」1品 */
export type EditorDish = { dish_id: string; kind_id: string; name: string; photo_url: string | null }

export type MenuDishesValue = { tray: string | null; items: EditorDish[] }

/** API から返った献立の料理を、編集用の形にする */
export const fromMenuDishes = (rows: MenuDish[]): EditorDish[] =>
  [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({ dish_id: r.dish_id, kind_id: r.dish.kind_id, name: r.dish.name, photo_url: r.photo_url }))

/** API に送る形にする（並び順どおり） */
export const toApiDishes = (items: EditorDish[]) =>
  items.map((i) => ({ dish_id: i.dish_id, photo_url: i.photo_url }))

type Props = {
  /** 園の写真の種類（使っていないものも含む） */
  kinds: PhotoKind[]
  /** 園の料理の一覧 */
  library: DishSummary[]
  value: MenuDishesValue
  onChange: (next: MenuDishesValue) => void
  /** 写真をアップロードして公開URLを返す。失敗したら null */
  onUpload: (file: File) => Promise<string | null>
  onNotify: (msg: string, isError?: boolean) => void
  /** 料理を登録・変更したあと（料理の一覧を取り直すため） */
  onLibraryChange: () => void
  /** 同じ画面に複数あるときに input の id が重ならないようにする */
  idPrefix: string
}

/** 写真1枠ぶんの欄 */
function PhotoSlot({
  id, label, url, large, uploading, onPick, onRemove,
}: {
  id: string
  label?: string
  url: string | null
  large?: boolean
  uploading: boolean
  onPick: (file: File) => void
  onRemove: () => void
}) {
  return (
    <div className={`fa-photoslot${large ? ' is-large' : ''}`}>
      {label && <p className="fa-photoslot-label">{label}</p>}
      <div className="fa-drop" onClick={() => !uploading && document.getElementById(id)?.click()}>
        {uploading ? (
          <div className="fa-drop-empty"><span className="fa-drop-text">アップロード中…</span></div>
        ) : url ? (
          <AdminImg src={url} alt={`${label ?? '料理'}の写真`} className="fa-preview" />
        ) : (
          <div className="fa-drop-empty">
            <span className="fa-drop-icon">📷</span>
            <span className="fa-drop-text">タップして選ぶ</span>
          </div>
        )}
      </div>
      {url && !uploading && (
        <button type="button" onClick={onRemove} className="fa-photoslot-remove">✕ 写真を外す</button>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
    </div>
  )
}

export default function MenuDishesEditor({
  kinds, library, value, onChange, onUpload, onNotify, onLibraryChange, idPrefix,
}: Props) {
  /** アップロード中の枠（'tray' か 料理のID） */
  const [uploading, setUploading] = useState<string | null>(null)
  /** 料理を探している種類のID */
  const [addingKind, setAddingKind] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  /** レシピを編集している料理のID */
  const [recipeOf, setRecipeOf] = useState<string | null>(null)

  const libraryOf = new Map(library.map((d) => [d.id, d]))
  const shownKinds = sortKinds(kinds).filter(
    (k) => k.is_active || value.items.some((i) => i.kind_id === k.id)
  )

  /* ---------------- 写真 ---------------- */

  const upload = async (slot: string, file: File) => {
    setUploading(slot)
    const url = await onUpload(file)
    setUploading(null)
    if (!url) return
    if (slot === 'tray') onChange({ ...value, tray: url })
    else setPhoto(slot, url)
  }

  const setPhoto = (dishId: string, url: string | null) =>
    onChange({
      ...value,
      items: value.items.map((i) => (i.dish_id === dishId ? { ...i, photo_url: url } : i)),
    })

  /* ---------------- 料理を足す・外す ---------------- */

  const addDish = (d: { id: string; kind_id: string; name: string }) => {
    if (value.items.some((i) => i.dish_id === d.id)) return
    onChange({
      ...value,
      items: [...value.items, { dish_id: d.id, kind_id: d.kind_id, name: d.name, photo_url: null }],
    })
    setAddingKind(null)
    setQuery('')
  }

  const removeDish = (dishId: string) =>
    onChange({ ...value, items: value.items.filter((i) => i.dish_id !== dishId) })

  /** 一覧にない名前を、新しい料理として登録してから足す */
  const createDish = async (kind: PhotoKind, name: string) => {
    setCreating(true)
    const r = await fetchJson<DishResponse>('/api/admin/dishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind_id: kind.id, name }),
    })
    setCreating(false)
    if (!r.ok) { onNotify(r.json.error, true); return }
    onNotify(`「${r.json.dish.name}」を${kind.label}として登録しました。`)
    addDish(r.json.dish)
    onLibraryChange()
  }

  /* ---------------- 描画 ---------------- */

  const renderSearch = (kind: PhotoKind) => {
    const q = query.trim()
    const candidates = library
      .filter((d) => d.kind_id === kind.id)
      .filter((d) => !value.items.some((i) => i.dish_id === d.id))
      .filter((d) => !q || d.name.includes(q))
      .sort((a, b) => (b.last_served_date ?? '').localeCompare(a.last_served_date ?? ''))
      .slice(0, 20)
    const exact = library.some((d) => d.kind_id === kind.id && d.name === q)

    return (
      <div className="fa-dishsearch">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${kind.label}の料理名で探す（例：さば）`}
          className="fa-input"
          autoFocus
        />
        {candidates.length > 0 ? (
          <div className="fa-dishsearch-list">
            {candidates.map((d) => (
              <button key={d.id} type="button" onClick={() => addDish(d)} className="fa-dishsearch-item">
                <span className="fa-dishsearch-name">{d.name}{d.has_recipe && ' 🍳'}</span>
                <span className="fa-dishsearch-meta">
                  {d.last_served_date ? `前回 ${formatShort(d.last_served_date)}・${d.times_served}回` : 'まだ出していない'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="fa-note" style={{ marginTop: 8 }}>
            {q ? '見つかりませんでした。' : `まだ${kind.label}の料理が登録されていません。`}
          </p>
        )}
        <div className="fa-btnrow">
          {q && !exact && (
            <button
              type="button"
              onClick={() => createDish(kind, q)}
              disabled={creating}
              className="fa-btn fa-btn--sky"
            >
              {creating ? '登録中…' : `＋「${q}」を新しい${kind.label}として登録`}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setAddingKind(null); setQuery('') }}
            className="fa-btn fa-btn--ghost"
          >
            閉じる
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PhotoSlot
        id={`${idPrefix}-tray`}
        label="お盆全体"
        url={value.tray}
        large
        uploading={uploading === 'tray'}
        onPick={(file) => upload('tray', file)}
        onRemove={() => onChange({ ...value, tray: null })}
      />

      {shownKinds.map((k) => {
        const items = value.items.filter((i) => i.kind_id === k.id)
        return (
          <div key={k.id} className="fa-kindblock">
            <p className="fa-kindblock-head">
              {k.label}
              {!k.is_active && <span className="fa-attclass">使っていない種類</span>}
            </p>

            {items.map((item) => {
              const lib = libraryOf.get(item.dish_id)
              return (
                <div key={item.dish_id}>
                  <div className="fa-dishitem">
                    <PhotoSlot
                      id={`${idPrefix}-${item.dish_id}`}
                      url={item.photo_url}
                      uploading={uploading === item.dish_id}
                      onPick={(file) => upload(item.dish_id, file)}
                      onRemove={() => setPhoto(item.dish_id, null)}
                    />
                    <div className="fa-dishitem-body">
                      <p className="fa-dishitem-name">{item.name}{lib?.has_recipe && ' 🍳'}</p>
                      <div className="fa-dishitem-actions">
                        {!item.photo_url && lib?.last_photo_url && (
                          <button
                            type="button"
                            onClick={() => setPhoto(item.dish_id, lib.last_photo_url)}
                            className="fa-filterbtn"
                          >
                            前回の写真を使う
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRecipeOf(recipeOf === item.dish_id ? null : item.dish_id)}
                          className={`fa-filterbtn${recipeOf === item.dish_id ? ' is-on' : ''}`}
                        >
                          {lib?.has_recipe ? 'レシピを直す' : 'レシピを入れる'}
                        </button>
                        <button type="button" onClick={() => removeDish(item.dish_id)} className="fa-filterbtn">
                          ✕ 外す
                        </button>
                      </div>
                    </div>
                  </div>

                  {recipeOf === item.dish_id && (
                    <RecipeEditor
                      dishId={item.dish_id}
                      onNotify={onNotify}
                      onClose={() => setRecipeOf(null)}
                      onSaved={(dish) => {
                        /* 料理名を直した場合に、この欄の表示も合わせる */
                        onChange({
                          ...value,
                          items: value.items.map((i) => (i.dish_id === dish.id ? { ...i, name: dish.name } : i)),
                        })
                        onLibraryChange()
                      }}
                    />
                  )}
                </div>
              )
            })}

            {addingKind === k.id ? (
              renderSearch(k)
            ) : (
              <button
                type="button"
                onClick={() => { setAddingKind(k.id); setQuery('') }}
                className="fa-filterbtn"
                style={{ marginTop: 6 }}
              >
                ＋ {k.label}を追加
              </button>
            )}
          </div>
        )
      })}

      <p className="fa-note" style={{ marginTop: 8 }}>
        入れた料理と写真だけが保護者に表示されます。全部そろえなくてかまいません。
      </p>
    </div>
  )
}
