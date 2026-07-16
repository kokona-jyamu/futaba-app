import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const ALLERGENS: { [key: string]: { label: string; emoji: string | null } } = {
  egg:       { label: '卵',     emoji: '🥚' },
  milk:      { label: '乳',     emoji: '🥛' },
  wheat:     { label: '小麦',   emoji: '🌾' },
  buckwheat: { label: 'そば',   emoji: '🍜' },
  peanut:    { label: '落花生', emoji: '🥜' },
  shrimp:    { label: 'えび',   emoji: '🦐' },
  crab:      { label: 'かに',   emoji: '🦀' },
  walnut:    { label: 'くるみ', emoji: '🌰' },
  cashew:    { label: 'カシュー', emoji: null },
}

const ALL_ALLERGENS = [
  { key: 'egg',       label: '卵',     emoji: '🥚' },
  { key: 'milk',      label: '乳',     emoji: '🥛' },
  { key: 'wheat',     label: '小麦',   emoji: '🌾' },
  { key: 'buckwheat', label: 'そば',   emoji: '🍜' },
  { key: 'peanut',    label: '落花生', emoji: '🥜' },
  { key: 'shrimp',    label: 'えび',   emoji: '🦐' },
  { key: 'crab',      label: 'かに',   emoji: '🦀' },
  { key: 'walnut',    label: 'くるみ', emoji: '🌰' },
  { key: 'cashew',    label: 'カシュー', emoji: null },
]

type Props = {
  params: Promise<{ key: string }>
}

export default async function AllergenMenuPage({ params }: Props) {
  const { key } = await params
  const allergen = ALLERGENS[key]

  if (!allergen) {
    return (
      <main style={{ padding: '1rem' }}>
        <p>アレルゲンが見つかりませんでした</p>
        <Link href="/allergen">← 一覧に戻る</Link>
      </main>
    )
  }

  const { data: menus } = await supabase
    .from('menus')
    .select('*')
    .order('served_date', { ascending: false })

  const filtered = (menus || []).filter(m => {
    const allergens = m.allergens as { [k: string]: boolean } | null
    return allergens?.[key] === true
  })

  return (
    <main style={{ width: '100%', maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>

      <Link href="/allergen" style={{ fontSize: '13px', color: '#1D9E75' }}>
        ← アレルゲン一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div style={{ marginTop: '12px', marginBottom: '20px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          backgroundColor: '#FFF0E6', border: '1.5px solid #BA7517',
          borderRadius: '12px', padding: '6px 14px', marginBottom: '8px',
        }}>
          {allergen.emoji ? (
            <span style={{ fontSize: '20px' }}>{allergen.emoji}</span>
          ) : (
            <div style={{
              width: '22px', height: '22px', borderRadius: '6px',
              border: '1.5px solid #BA7517', backgroundColor: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 'bold', color: '#BA7517',
            }}>C</div>
          )}
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#BA7517' }}>
            {allergen.label}を含む献立
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>
            {filtered.length}件見つかりました
          </span>
        </div>
      </div>

      {/* 献立一覧 */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 0',
          fontSize: '14px', color: '#999',
        }}>
          {allergen.label}を含む献立はありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(menu => {
            const allergens = menu.allergens as { [k: string]: boolean } | null
            const activeAllergens = ALL_ALLERGENS.filter(a => allergens?.[a.key] === true)

            return (
              <Link key={menu.id} href={`/menu/${menu.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  border: '1px solid #e0e0e0', borderRadius: '12px',
                  padding: '14px', backgroundColor: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                    {new Date(menu.served_date + 'T00:00:00').toLocaleDateString('ja-JP', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                  <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '8px' }}>
                    {menu.title}
                  </p>

                  {/* アレルゲンチップ */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {activeAllergens.map(a => (
                      <span key={a.key} style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                        backgroundColor: a.key === key ? '#FFF0E6' : '#f5f5f5',
                        color: a.key === key ? '#BA7517' : '#888',
                        fontWeight: a.key === key ? 'bold' : 'normal',
                        border: a.key === key ? '1px solid #FAC775' : '1px solid #e0e0e0',
                      }}>
                        {a.emoji || 'C'} {a.label}
                      </span>
                    ))}
                  </div>

                  <p style={{ fontSize: '12px', color: '#1D9E75', textAlign: 'right' }}>
                    詳しく見る →
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

    </main>
  )
}