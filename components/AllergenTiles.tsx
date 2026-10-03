/* components/AllergenTiles.tsx
 *
 * アレルゲン別献立への入口。保護者トップとアレルゲン一覧で共用する。
 * 定義は lib/allergens の28品目を使い、表示義務8品目と推奨20品目に分けて並べる。
 */

import Link from 'next/link'
import { REQUIRED_ALLERGENS, OPTIONAL_ALLERGENS, type AllergenDef } from '@/lib/allergens'

const Tiles = ({ list }: { list: AllergenDef[] }) => (
  <div className="fa-tiles">
    {list.map((a) => (
      <Link key={a.key} href={`/allergen/${a.key}`} className="fa-link">
        <div className="fa-tile">
          <span className="fa-tile-emoji">{a.emoji}</span>
          <span className="fa-tile-label">{a.label}</span>
        </div>
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
