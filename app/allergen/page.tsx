/* app/allergen/page.tsx */

import Link from 'next/link'
import { ALLERGENS } from '@/lib/menu'

export default function AllergenIndexPage() {
  return (
    <main className="fa-page">
      <Link href="/" className="fa-back">← 給食だよりに戻る</Link>

      <div className="fa-pagehead">
        <h1 className="fa-title">🔍 アレルゲン別献立</h1>
        <p className="fa-lead">気になるアレルゲンをタップすると、それを使っていない献立を絞り込めます。</p>
      </div>

      <div className="fa-tiles">
        {ALLERGENS.map((a) => (
          <Link key={a.key} href={`/allergen/${a.key}`} className="fa-link">
            <div className="fa-tile">
              <span className="fa-tile-emoji">{a.emoji}</span>
              <span className="fa-tile-label">{a.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}