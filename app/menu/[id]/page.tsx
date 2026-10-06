/* app/menu/[id]/page.tsx
 *
 * サーバーコンポーネント。
 * RLS を有効にすると、ブラウザ用クライアントではセッションが渡らず
 * 献立を取得できなくなるため、createSupabaseServer を使う。
 */

import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPhotoKinds } from '@/lib/photoKinds'
import { mainPhotoOf, orderDishes } from '@/lib/menuPhotos'
import { toRecipe, hasRecipe } from '@/lib/recipes'
import MenuPhotos, { type MenuPhotoDish } from '@/components/MenuPhotos'
import { formatDate, formatIngredients } from '@/lib/menu'
import { usedAllergens } from '@/lib/allergens'
import MessageSection from '@/components/MessageSection'

type Props = { params: Promise<{ id: string }> }

export default async function MenuDetail({ params }: Props) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: menu, error } = await supabase
    .from('menus')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !menu) {
    return (
      <main className="fa-page">
        <p className="fa-empty">献立が見つかりませんでした。</p>
        <Link href="/" className="fa-back">← 一覧に戻る</Link>
      </main>
    )
  }

  const used = usedAllergens(menu.allergens)
  const ingredients = formatIngredients(menu.ingredients)

  /* その日の料理とレシピ。dishes / menu_dishes はブラウザから読めないため、
     献立が見られること（上の RLS つきの読み取り）を確かめてからサーバー側で読む */
  const kinds = menu.school_id ? await getPhotoKinds(menu.school_id) : []
  const { data: rows } = await supabaseAdmin
    .from('menu_dishes')
    .select('id, photo_url, sort_order, dishes(id, kind_id, name, recipe_servings, recipe_ingredients, recipe_steps, recipe_tip)')
    .eq('menu_id', menu.id)

  const dayDishes = orderDishes(
    (rows ?? []).flatMap((r) =>
      r.dishes ? [{ ...r, kind_id: r.dishes.kind_id, dish: r.dishes }] : []
    ),
    kinds
  )

  /* 写真：大きく出す1枚（お盆全体 → 主菜 → 他の料理）。同じ写真はカードに重ねて出さない */
  const mainPhoto = mainPhotoOf(menu.tray_photo_url, dayDishes, kinds)
  const labelOf = new Map(kinds.map((k) => [k.id, k.label]))
  const dishes: MenuPhotoDish[] = dayDishes.map((d) => {
    const recipe = toRecipe(d.dish)
    return {
      id: d.id,
      kindLabel: labelOf.get(d.kind_id) ?? '',
      name: d.dish.name,
      url: d === mainPhoto?.fromDish ? null : d.photo_url,
      recipe: hasRecipe(recipe) ? recipe : null,
    }
  })

  return (
    <main className="fa-page" style={{ maxWidth: 720 }}>
      <Link href="/" className="fa-back">← 給食だよりに戻る</Link>

      <div className="fa-pagehead">
        <p className="fa-date">{formatDate(menu.served_date)}</p>
        <h1 className="fa-title" style={{ marginTop: 4 }}>{menu.title}</h1>
      </div>

      <MenuPhotos
        title={menu.title ?? ''}
        mainUrl={mainPhoto?.url ?? null}
        dishes={dishes}
      />

      {/* アレルギー */}
      <section className="fa-card" style={{ marginBottom: 16 }}>
        <h2 className="fa-cardtitle">アレルギー情報</h2>

        {!menu.allergen_checked ? (
          <p className="fa-algnone" style={{ marginTop: 12, background: '#F1F0EC', color: '#74807A' }}>
            ？ まだ登録されていません。園にお問い合わせください。
          </p>
        ) : used.length === 0 ? (
          <p className="fa-algnone" style={{ marginTop: 12 }}>
            ✓ 表示対象の食材は使っていません
          </p>
        ) : (
          <>
            <div className="fa-chips" style={{ marginTop: 12 }}>
              {used.map((a) => (
                <span key={a.key} className="fa-chip is-on">
                  <span className="fa-chip-emoji">{a.emoji}</span>
                  <span className="fa-chip-label">{a.label}</span>
                </span>
              ))}
            </div>
            <p className="fa-note" style={{ marginTop: 10 }}>
              上記のほかは使用していません。調味料や加工品に含まれる微量の成分については、
              気になる場合は園にご確認ください。
            </p>
          </>
        )}
      </section>

      {/* 主な食材 */}
      {ingredients && (
        <section className="fa-card" style={{ marginBottom: 16 }}>
          <h2 className="fa-cardtitle">主な食材</h2>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.9, color: 'var(--fa-ink)' }}>
            {ingredients}
          </p>
        </section>
      )}

      {/* 栄養価 */}
      <section className="fa-card" style={{ marginBottom: 16 }}>
        <h2 className="fa-cardtitle">栄養価</h2>
        <div className="fa-nutri" style={{ marginTop: 12 }}>
          {[
            { label: 'エネルギー', value: menu.kcal,    unit: 'kcal' },
            { label: '炭水化物',   value: menu.carb,    unit: 'g' },
            { label: 'タンパク質', value: menu.protein, unit: 'g' },
            { label: '脂質',       value: menu.fat,     unit: 'g' },
            { label: '食塩相当量', value: menu.salt,    unit: 'g' },
            { label: 'カルシウム', value: menu.calcium, unit: 'mg' },
          ].map((n) => (
            <div key={n.label} className="fa-nutricell">
              <p className="fa-nutrilabel">{n.label}</p>
              <p className="fa-nutrivalue">
                {n.value ?? '—'}
                <span className="fa-nutriunit">{n.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 栄養士コメント */}
      {menu.nutritionist_comment && (
        <div className="fa-tint fa-tint--green" style={{ marginBottom: 16 }}>
          <h2 className="fa-tinttitle">🌿 栄養士より</h2>
          <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--fa-ink)' }}>
            {menu.nutritionist_comment}
          </p>
        </div>
      )}

      {/* 食べっぷり */}
      {menu.why_eat_note && (
        <div className="fa-tint fa-tint--apricot" style={{ marginBottom: 16 }}>
          <h2 className="fa-tinttitle fa-tinttitle--apricot">🍴 今日の食べっぷり</h2>
          <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--fa-ink)' }}>
            {menu.why_eat_note}
          </p>
        </div>
      )}

      <MessageSection menuId={menu.id} />
    </main>
  )
}