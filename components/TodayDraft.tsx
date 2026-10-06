/* components/TodayDraft.tsx — 今日の下書きを公開する
 *
 * 月間で登録した下書きのうち、今日の分を最上部に出す。
 * 写真とコメントを足して公開できる。
 */
'use client'

import { useState } from 'react'
import { formatDate, formatIngredients } from '@/lib/menu'
import { usedAllergens } from '@/lib/allergens'
import type { AdminMenu, DishSummary } from '@/lib/apiTypes'
import MenuDishesEditor, {
  fromMenuDishes, toApiDishes, type MenuDishesValue,
} from '@/components/MenuDishesEditor'
import type { PhotoKind } from '@/lib/menuPhotos'

type Props = {
  menu: AdminMenu
  /** 園の写真の種類（主食・汁物・主菜・副菜 など） */
  photoKinds: PhotoKind[]
  /** 園の料理の一覧 */
  library: DishSummary[]
  onPublish: (
    id: string,
    patch: { nutritionist_comment: string; why_eat_note: string; tray_photo_url: string | null; dishes: { dish_id: string; photo_url: string | null }[] }
  ) => Promise<boolean>
  onUploadPhoto: (file: File) => Promise<string | null>
  onNotify: (msg: string, isError?: boolean) => void
  /** 料理を登録・変更したあと */
  onLibraryChange: () => void
}

export default function TodayDraft({
  menu, photoKinds, library, onPublish, onUploadPhoto, onNotify, onLibraryChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState(menu.nutritionist_comment ?? '')
  const [note, setNote] = useState(menu.why_eat_note ?? '')
  /* 月間登録で入れた料理があれば、そのまま出しておく */
  const [dishes, setDishes] = useState<MenuDishesValue>({
    tray: menu.tray_photo_url,
    items: fromMenuDishes(menu.menu_dishes),
  })
  const [loading, setLoading] = useState(false)

  const used = usedAllergens(menu.allergens)
  const ingredients = formatIngredients(menu.ingredients)

  const publish = async () => {
    setLoading(true)
    await onPublish(menu.id, {
      nutritionist_comment: comment,
      why_eat_note: note,
      tray_photo_url: dishes.tray,
      dishes: toApiDishes(dishes.items),
    })
    setLoading(false)
  }

  return (
    <section className="fa-todaycard">
      <div className="fa-todayhead">
        <div style={{ minWidth: 0 }}>
          <p className="fa-todaylabel">
            <span className="fa-draftbadge">下書き</span>
            {formatDate(menu.served_date)}の献立
          </p>
          <h2 className="fa-todaytitle">{menu.title}</h2>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="fa-btn fa-btn--primary" style={{ flex: '0 0 auto', minWidth: 0 }}>
            写真とコメントを入れる
          </button>
        )}
      </div>

      <div className="fa-tagrow" style={{ marginTop: 10 }}>
        {used.length === 0 ? (
          <span className="fa-tag fa-tag--none">✓ アレルゲン該当なし</span>
        ) : (
          used.map((a) => (
            <span key={a.key} className="fa-tag">{a.emoji} {a.label}</span>
          ))
        )}
        {menu.kcal != null && <span className="fa-tag fa-tag--plain">{menu.kcal} kcal</span>}
      </div>

      {ingredients && (
        <p className="fa-note" style={{ marginTop: 8 }}>{ingredients}</p>
      )}

      {open && (
        <div style={{ marginTop: 18 }}>
          <label className="fa-label">料理と写真</label>
          <MenuDishesEditor
            kinds={photoKinds}
            library={library}
            value={dishes}
            onChange={setDishes}
            onUpload={onUploadPhoto}
            onNotify={onNotify}
            onLibraryChange={onLibraryChange}
            idPrefix={`today-photo-${menu.id}`}
          />

          <label className="fa-label">栄養士コメント</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="今日の給食のポイントを書いてください"
            className="fa-input fa-textarea"
          />

          <label className="fa-label">今日の食べっぷり</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="子どもたちの様子を書いてください"
            className="fa-input fa-textarea"
          />

          <div className="fa-btnrow">
            <button onClick={publish} disabled={loading} className="fa-btn fa-btn--primary">
              {loading ? '公開中…' : '保護者に公開する'}
            </button>
            <button onClick={() => setOpen(false)} className="fa-btn fa-btn--ghost">
              あとで
            </button>
          </div>

          <p className="fa-note" style={{ marginTop: 10 }}>
            写真やコメントがなくても公開できます。あとから「献立を編集」で足せます。
          </p>
        </div>
      )}
    </section>
  )
}