/* components/EventVideo.tsx — 食育の動画（保護者画面・管理画面）
 *
 * 動画は非公開なので、押したときにサーバーから時間で切れる再生用の URL をもらってから再生する。
 * 一覧を開いただけでは動画を読み込まない（通信量を使わない）。
 */
'use client'

import { useState } from 'react'
import { fetchJson } from '@/lib/useLoadEffect'
import type { VideoUrlResponse } from '@/lib/apiTypes'

export default function EventVideo({ eventId }: { eventId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async () => {
    setLoading(true)
    setError(null)
    const r = await fetchJson<VideoUrlResponse>(`/api/events/${eventId}/video`)
    setLoading(false)
    if (!r.ok) { setError(r.json.error); return }
    setUrl(r.json.url)
  }

  if (url) {
    return (
      <video
        src={url}
        controls
        autoPlay
        playsInline
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="fa-event-video"
      />
    )
  }

  return (
    <div className="fa-event-videobox">
      <button type="button" onClick={open} disabled={loading} className="fa-filterbtn">
        {loading ? '読み込んでいます…' : '▶ 動画を見る'}
      </button>
      {error && <p className="fa-note" style={{ color: 'var(--fa-rose-ink)' }}>{error}</p>}
    </div>
  )
}
