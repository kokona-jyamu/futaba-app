/* components/MenuPhotos.tsx — 献立詳細の写真と料理（お盆全体＋料理ごと）
 *
 *  - パソコン：大きい写真の下に、料理ごとのカード（写真・種類・料理名）を2列で並べる
 *  - スマホ　：大きい写真だけを出し、タップすると料理のカードが直下に開く（もう一度で閉じる）
 *  - レシピのある料理は「レシピを見る」で、カードの下にレシピを開く
 * 写真のない料理も料理名は出す。出し分けは CSS（futaba-menu.css の .fa-menuphotos まわり）で行う。
 */
'use client'

import { useState } from 'react'
import Image from 'next/image'
import RecipeView from '@/components/RecipeView'
import type { Recipe } from '@/lib/apiTypes'

export type MenuPhotoDish = {
  id: string
  kindLabel: string
  name: string
  /** その日の写真。大きく出した写真と同じものは null にしてある */
  url: string | null
  recipe: Recipe | null
}

type Props = {
  title: string
  /** 大きく出す写真（お盆全体 → 主菜 → 他の料理）。なければ null */
  mainUrl: string | null
  /** その日の料理（種類の並び順） */
  dishes: MenuPhotoDish[]
}

export default function MenuPhotos({ title, mainUrl, dishes }: Props) {
  const [open, setOpen] = useState(false)
  const [recipeOf, setRecipeOf] = useState<string | null>(null)

  const hasDishes = dishes.length > 0
  const shownRecipe = dishes.find((d) => d.id === recipeOf && d.recipe)

  return (
    <section className="fa-menuphotos">
      {mainUrl ? (
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
              {open ? '▲ 閉じる' : `📷 料理ごとの写真（${dishes.length}品）`}
            </span>
          )}
        </button>
      ) : (
        <div className="fa-event-photo--empty" style={{ borderRadius: 'var(--fa-r)' }}>
          🍽 写真準備中
        </div>
      )}

      {hasDishes && (
        /* 大きい写真がないときは、スマホでも最初から開いておく */
        <div className={`fa-dishgrid${open || !mainUrl ? ' is-open' : ''}`}>
          {dishes.map((d) => (
            <figure key={d.id} className="fa-dish">
              {d.url ? (
                <Image
                  src={d.url}
                  alt={`${title}（${d.name}）`}
                  width={600}
                  height={400}
                  sizes="(max-width: 720px) 50vw, 360px"
                />
              ) : (
                <div className="fa-dish-nophoto">{d.kindLabel}</div>
              )}
              <figcaption>
                <span className="fa-dish-kind">{d.kindLabel}</span>
                <span className="fa-dish-name">{d.name}</span>
                {d.recipe && (
                  <button
                    type="button"
                    className="fa-textlink"
                    onClick={() => setRecipeOf(recipeOf === d.id ? null : d.id)}
                    aria-expanded={recipeOf === d.id}
                  >
                    {recipeOf === d.id ? '▲ レシピを閉じる' : '🍳 レシピを見る'}
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {shownRecipe?.recipe && <RecipeView name={shownRecipe.name} recipe={shownRecipe.recipe} />}
    </section>
  )
}
