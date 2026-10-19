/* components/AllergenTiles.tsx
 *
 * アレルゲン別献立への入口。保護者トップとアレルゲン一覧で共用する。
 * 定義は lib/allergens の28品目を使い、表示義務8品目と推奨20品目に分けて並べる。
 * 見た目は Material Design 3 のアウトラインのボタン（文字だけ・絵文字なし）。
 * 表示義務8品目は文字を太くして見分ける。
 */

import Link from 'next/link'
import Icon from '@/components/Icon'
import { REQUIRED_ALLERGENS, OPTIONAL_ALLERGENS, type AllergenDef } from '@/lib/allergens'

const Tiles = ({ list }: { list: AllergenDef[] }) => (
  <div className="fa-tiles">
    {list.map((a) => (
      <Link
        key={a.key}
        href={`/allergen/${a.key}`}
        className={`fa-tile${a.required ? ' is-required' : ''}`}
      >
        <span className="fa-tile-label">{a.label}</span>
        <Icon name="chevron_right" size={18} className="fa-tile-arrow" />
      </Link>
    ))}
  </div>
)

export default function AllergenTiles() {
  return (
    <>
      <h2 className="fa-subtitle">表示義務8品目</h2>
      <Tiles list={REQUIRED_ALLERGENS} />

      <h2 className="fa-subtitle">表示推奨20品目</h2>
      <Tiles list={OPTIONAL_ALLERGENS} />
    </>
  )
}
