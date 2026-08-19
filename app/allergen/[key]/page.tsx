/* app/allergen/[key]/page.tsx
 *
 * 「そのアレルゲンを使っていない献立」を探すためのページ。
 *
 * 重要：単純に allergens[key] !== true で絞ると、
 *       栄養士が入力し忘れた献立まで「使っていない」側に入ってしまう。
 *       未入力は必ず「未確認」として区別する。
 */

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ALLERGENS, formatDate } from '@/lib/menu'

type Props = { params: Promise<{ key: string }> }

/** アレルギー欄が1つでも登録されているか（未入力の判定） */
const isChecked = (allergens: unknown) =>
  !!allergens &&
  typeof allergens === 'object' &&
  Object.keys(allergens as object).length > 0

export default async function AllergenMenuPage({ params }: Props) {
  const { key } = await params
  const allergen = ALLERGENS.find((a) => a.key === key)

  if (!allergen) {
    return (
      <main className="fa-page">
        <p className="fa-empty">アレルゲンが見つかりませんでした。</p>
        <Link href="/allergen" className="fa-back">← 一覧に戻る</Link>
      </main>
    )
  }

  const { data: menus } = await supabase
    .from('menus')
    .select('*')
    .order('served_date', { ascending: false })

  const all = menus ?? []

  /* 3つに分ける */
  const safe = all.filter((m) => isChecked(m.allergens) && m.allergens[key] !== true)
  const contains = all.filter((m) => isChecked(m.allergens) && m.allergens[key] === true)
  const unknown = all.filter((m) => !isChecked(m.allergens))

  const renderCard = (menu: any, state: 'safe' | 'contains' | 'unknown') => {
    const used = ALLERGENS.filter((a) => menu.allergens?.[a.key] === true)

    return (
      <Link key={menu.id} href={`/menu/${menu.id}`} className="fa-link">
        <article className={`fa-card fa-alg fa-alg--${state}`}>
          <p className="fa-date">{formatDate(menu.served_date)}</p>
          <p className="fa-menuname">{menu.title}</p>

          <p className={`fa-algstate fa-algstate--${state}`}>
            {state === 'safe' && `✓ ${allergen.label}は使っていません`}
            {state === 'contains' && `⚠️ ${allergen.label}を使っています`}
            {/* {state === 'unknown' && '？ アレルギー情報が未登録です'} */}
          </p>

          {used.length > 0 && (
            <div className="fa-tagrow">
              {used.map((a) => (
                <span
                  key={a.key}
                  className={`fa-tag${a.key === key ? ' fa-tag--hit' : ''}`}
                >
                  {a.emoji} {a.label}
                </span>
              ))}
            </div>
          )}

          <p className="fa-more">詳しく見る →</p>
        </article>
      </Link>
    )
  }

  return (
    <main className="fa-page">
      <Link href="/allergen" className="fa-back">← アレルゲン一覧に戻る</Link>

      <div className="fa-pagehead">
        <h1 className="fa-title">
          {allergen.emoji} {allergen.label}で絞り込み
        </h1>
        <p className="fa-lead">
          {allergen.label}を使っていない献立が{safe.length}件あります。
        </p>
      </div>

      <div className="fa-warnbox">
        <p className="fa-warntitle">ご確認ください</p>
        <p className="fa-warntext">
          この一覧は園が登録した情報にもとづく目安です。
          調味料や加工品に含まれる微量の成分までは反映されていない場合があります。
          重いアレルギーがある場合は、必ず園に直接ご確認ください。
        </p>
      </div>

      {/* 未確認：安全とは言えないので先に出す
      {unknown.length > 0 && (
        <>
          <h2 className="fa-subtitle">
            ？ アレルギー情報が未登録の献立（{unknown.length}件）
          </h2>
          <p className="fa-note" style={{ marginBottom: 12 }}>
            登録がないため、{allergen.label}を使っているかどうか判断できません。
            園にお問い合わせください。
          </p>
          <div className="fa-grid">
            {unknown.map((m) => renderCard(m, 'unknown'))}
          </div>
        </>
      )} */}

      {/* 使っていない */}
      <h2 className="fa-subtitle">
        ✓ {allergen.label}を使っていない献立（{safe.length}件）
      </h2>
      {safe.length === 0 ? (
        <p className="fa-empty">
          {allergen.label}を使っていない献立は、いまのところありません。
        </p>
      ) : (
        <div className="fa-grid">{safe.map((m) => renderCard(m, 'safe'))}</div>
      )}

      {/* 使っている */}
      {contains.length > 0 && (
        <>
          <h2 className="fa-subtitle">
            ⚠️ {allergen.label}を使っている献立（{contains.length}件）
          </h2>
          <div className="fa-grid">
            {contains.map((m) => renderCard(m, 'contains'))}
          </div>
        </>
      )}
    </main>
  )
}