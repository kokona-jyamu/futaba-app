/* components/MenuPhotoInputs.tsx — 献立の写真の登録欄（管理画面）
 *
 * 「お盆全体」と、園で「使う」にしている写真の種類の数だけ欄を出す。
 * 写真は選んだ時点でアップロードし、URL を親に渡す（保存は親の「公開」「保存」ボタンで行う）。
 * いまは使っていない種類でも、この献立に写真が入っていれば欄を残す（外せるように）。
 */
'use client'

import { useState } from 'react'
import AdminImg from '@/components/AdminImg'
import { sortKinds, type DishPhotos, type PhotoKind } from '@/lib/menuPhotos'

export type MenuPhotoValue = { tray: string | null; dish: DishPhotos }

type Props = {
  /** 園の写真の種類（使っていないものも含む） */
  kinds: PhotoKind[]
  value: MenuPhotoValue
  onChange: (next: MenuPhotoValue) => void
  /** 写真をアップロードして公開URLを返す。失敗したら null */
  onUpload: (file: File) => Promise<string | null>
  /** 同じ画面に複数あるときに input の id が重ならないようにする */
  idPrefix: string
}

/** 1枠ぶんの欄 */
function PhotoSlot({
  id, label, url, large, uploading, onPick, onRemove,
}: {
  id: string
  label: string
  url: string | null
  large?: boolean
  uploading: boolean
  onPick: (file: File) => void
  onRemove: () => void
}) {
  return (
    <div className={`fa-photoslot${large ? ' is-large' : ''}`}>
      <p className="fa-photoslot-label">{label}</p>
      <div className="fa-drop" onClick={() => !uploading && document.getElementById(id)?.click()}>
        {uploading ? (
          <div className="fa-drop-empty"><span className="fa-drop-text">アップロード中…</span></div>
        ) : url ? (
          <AdminImg src={url} alt={`${label}の写真`} className="fa-preview" />
        ) : (
          <div className="fa-drop-empty">
            <span className="fa-drop-icon">📷</span>
            <span className="fa-drop-text">タップして選ぶ</span>
          </div>
        )}
      </div>
      {url && !uploading && (
        <button type="button" onClick={onRemove} className="fa-photoslot-remove">
          ✕ 外す
        </button>
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

export default function MenuPhotoInputs({ kinds, value, onChange, onUpload, idPrefix }: Props) {
  /* アップロード中の枠（'tray' か 種類のID） */
  const [uploading, setUploading] = useState<string | null>(null)

  const shownKinds = sortKinds(kinds).filter((k) => k.is_active || value.dish[k.id])

  const upload = async (slot: string, file: File) => {
    setUploading(slot)
    const url = await onUpload(file)
    setUploading(null)
    if (!url) return
    if (slot === 'tray') onChange({ ...value, tray: url })
    else onChange({ ...value, dish: { ...value.dish, [slot]: url } })
  }

  const removeDish = (kindId: string) => {
    const dish = { ...value.dish }
    delete dish[kindId]
    onChange({ ...value, dish })
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

      {shownKinds.length > 0 && (
        <div className="fa-photoslots">
          {shownKinds.map((k) => (
            <PhotoSlot
              key={k.id}
              id={`${idPrefix}-${k.id}`}
              label={k.is_active ? k.label : `${k.label}（使っていない種類）`}
              url={value.dish[k.id] ?? null}
              uploading={uploading === k.id}
              onPick={(file) => upload(k.id, file)}
              onRemove={() => removeDish(k.id)}
            />
          ))}
        </div>
      )}

      <p className="fa-note" style={{ marginTop: 8 }}>
        入れた写真だけが保護者に表示されます。全部そろえなくてかまいません。
      </p>
    </div>
  )
}
