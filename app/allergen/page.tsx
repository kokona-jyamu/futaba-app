/* app/allergen/page.tsx */

import Link from 'next/link'
import AllergenTiles from '@/components/AllergenTiles'

export default function AllergenIndexPage() {
  return (
    <main className="fa-page">
      <Link href="/" className="fa-back">← 給食だよりに戻る</Link>

      <div className="fa-pagehead">
        <h1 className="fa-title">🔍 アレルゲン別献立</h1>
        <p className="fa-lead">気になるアレルゲンをタップすると、それを使っていない献立を絞り込めます。</p>
      </div>

      <AllergenTiles />
    </main>
  )
}
