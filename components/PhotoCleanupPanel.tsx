/* components/PhotoCleanupPanel.tsx — 使っていない写真の片付け（管理画面「設定」）
 *
 * 保存せずに閉じた・差し替えた・献立を消した、などで残った写真ファイルを探して消す。
 * 「調べる」で数と見本を確かめてから、「削除する」で消す（元に戻せない）。
 */
'use client'

import { useState } from 'react'
import AdminImg from '@/components/AdminImg'
import { fetchJson } from '@/lib/useLoadEffect'
import type { PhotoCleanupResponse, PhotoCleanupDoneResponse } from '@/lib/apiTypes'

type Props = {
  onNotify: (msg: string, isError?: boolean) => void
}

const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`

export default function PhotoCleanupPanel({ onNotify }: Props) {
  const [found, setFound] = useState<PhotoCleanupResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const check = async () => {
    setBusy(true)
    const r = await fetchJson<PhotoCleanupResponse>('/api/admin/photos/cleanup')
    setBusy(false)
    if (!r.ok) { onNotify(r.json.error, true); return }
    setFound(r.json)
  }

  const remove = async () => {
    if (!found) return
    if (!confirm(`使っていない写真${found.count}枚を削除します。元に戻せません。`)) return
    setBusy(true)
    const r = await fetchJson<PhotoCleanupDoneResponse>('/api/admin/photos/cleanup', { method: 'POST' })
    setBusy(false)
    if (!r.ok) { onNotify(r.json.error, true); return }
    onNotify(`使っていない写真を${r.json.deleted}枚削除しました。`)
    setFound(null)
  }

  return (
    <section className="fa-card" style={{ marginTop: 18 }}>
      <h2 className="fa-cardtitle">使っていない写真の片付け</h2>
      <p className="fa-note" style={{ marginTop: 6 }}>
        写真を選んだまま保存しなかったとき・写真を差し替えたとき・献立を消したときに、
        使われない写真が保存場所に残ります。どの献立・料理・食育の記録にも使われていない写真だけを削除します。
        入力の途中の写真を消さないよう、アップロードして1週間たっていない写真は対象にしません。
      </p>

      {found && (
        found.count === 0 ? (
          <p className="fa-note" style={{ marginTop: 12 }}>使っていない写真はありません。</p>
        ) : (
          <div style={{ marginTop: 12 }}>
            <p className="fa-label" style={{ marginTop: 0 }}>
              使っていない写真：{found.count}枚（{formatBytes(found.bytes)}）
            </p>
            <div className="fa-cleanupgrid">
              {found.samples.map((s) => (
                <AdminImg key={s.url} src={s.url} alt="" className="fa-cleanupthumb" loading="lazy" />
              ))}
            </div>
            {found.count > found.samples.length && (
              <p className="fa-note" style={{ marginTop: 6 }}>
                新しいものから{found.samples.length}枚を表示しています。
              </p>
            )}
          </div>
        )
      )}

      <div className="fa-btnrow">
        <button onClick={check} disabled={busy} className="fa-btn fa-btn--ghost">
          {busy && !found ? '調べています…' : found ? 'もう一度調べる' : '調べる'}
        </button>
        {found && found.count > 0 && (
          <button onClick={remove} disabled={busy} className="fa-btn fa-btn--primary">
            {busy ? '削除しています…' : `${found.count}枚を削除する`}
          </button>
        )}
      </div>
    </section>
  )
}
