/* app/allergen/[key]/page.tsx
 *
 * 「そのアレルゲンを使っていない献立」を探すためのページ。
 *
 * 重要：allergen_checked が false の献立は「登録されていない」ため、
 *       使っているかどうか判断できない。安全側に寄せて一覧から外し、
 *       件数と日付だけを別枠で知らせる。
 */

import Link from 'next/link'
import { createSupabaseServer } from '@/lib/superbase/server'
import { formatDate } from '@/lib/menu'
import { STANDARD_ALLERGENS, usedAllergens } from '@/lib/allergens'

type Props = { params: Promise<{ key: string }> }

export default async function AllergenMenuPage({ params }: Props) {
  const { key } = await params
  const supabase = await createSupabaseServer()

  const allergen = STANDARD_ALLERGENS.find((a) => a.key === key)

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

  /* 確認済みのものだけを2つに分け、未確認は別枠で知らせる */
  const safe = all.filter((m) => m.allergen_checked && m.allergens?.[key] !== true)
  const contains = all.filter((m) => m.allergen_checked && m.allergens?.[key] === true)
  const unknown = all.filter((m) => !m.allergen_checked)

  const renderCard = (menu: any, state: 'safe' | 'contains') => {
    const used = usedAllergens(menu.allergens)

    return (
      <Link key={menu.id} href={`/menu/${menu.id}`} className="fa-link">
        <article className={`fa-card fa-alg fa-alg--${state}`}>
          <p className="fa-date">{formatDate(menu.served_date)}</p>
          <p className="fa-menuname">{menu.title}</p>

          <p className={`fa-algstate fa-algstate--${state}`}>
            {state === 'safe'
              ? `✓ ${allergen.label}は使っていません`
              : `⚠️ ${allergen.label}を使っています`}
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

      {/* 使っていない献立 */}
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

      {/* 未確認：カードは出さず、日付だけ知らせる */}
      {unknown.length > 0 && (
        <div className="fa-warnbox" style={{ marginTop: 24 }}>
          <p className="fa-warntitle">
            アレルギー情報が未登録の献立が{unknown.length}件あります
          </p>
          <p className="fa-warntext">
            {unknown.map((m) => formatDate(m.served_date)).join('、')}
            の献立は、{allergen.label}を使っているかどうか登録されていません。
            上の一覧には含まれていないため、園にご確認ください。
          </p>
        </div>
      )}

      {/* 使っている献立 */}
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