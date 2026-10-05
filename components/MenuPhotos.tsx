/* components/MenuPhotos.tsx — 献立詳細の写真（お盆全体＋料理ごと）
 *
 *  - パソコン：大きい写真の下に、料理ごとの写真を2列で並べる
 *  - スマホ　：大きい写真だけを出し、タップすると料理ごとの写真が直下に開く（もう一度で閉じる）
 * 出し分けは CSS（futaba-menu.css の .fa-menuphotos まわり）で行う。
 */
'use client'

import { useState } from 'react'
import Image from 'next/image'

type Props = {
  title: string
  /** 大きく出す写真（お盆全体 → 主菜 → 他の料理）。なければ null */
  mainUrl: string | null
  /** 料理ごとの写真（大きく出した写真は除いてある） */
  dishes: { kindId: string; label: string; url: string }[]
}

export default function MenuPhotos({ title, mainUrl, dishes }: Props) {
  const [open, setOpen] = useState(false)

  if (!mainUrl) {
    return (
      <div className="fa-event-photo--empty" style={{ borderRadius: 'var(--fa-r)', marginBottom: 20 }}>
        🍽 写真準備中
      </div>
    )
  }

  const hasDishes = dishes.length > 0

  return (
    <section className="fa-menuphotos">
      <button
        type="button"
        className="fa-menuphotos-main"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={hasDishes ? open : undefined}
        disabled={!hasDishes}
      >
        {/* 幅・高さは縦横比の目安。表示の大きさは CSS で決める（ページ最上部の写真なので先読みする） */}
        <Image
          src={mainUrl}
          alt={title}
          width={1200}
          height={800}
          sizes="(max-width: 720px) 100vw, 720px"
          preload
        />
        {hasDishes && (
          <span className="fa-menuphotos-hint">
            {open ? '▲ 閉じる' : `📷 料理ごとの写真（${dishes.length}枚）`}
          </span>
        )}
      </button>

      {hasDishes && (
        <div className={`fa-dishgrid${open ? ' is-open' : ''}`}>
          {dishes.map((d) => (
            <figure key={d.kindId} className="fa-dish">
              <Image
                src={d.url}
                alt={`${title}（${d.label}）`}
                width={600}
                height={400}
                sizes="(max-width: 720px) 50vw, 360px"
              />
              <figcaption>{d.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}
