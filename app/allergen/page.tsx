import Link from 'next/link'

const ALLERGENS = [
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

export default function AllergenIndexPage() {
  return (
    <main style={{ width: '100%', maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>

      <Link href="/" style={{ fontSize: '13px', color: '#1D9E75' }}>
        ← 給食だよりに戻る
      </Link>

      <div style={{ marginTop: '12px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#085041' }}>
          🔍 アレルゲン別献立
        </h1>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
          気になるアレルゲンをタップして献立を検索できます
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
      }}>
        {ALLERGENS.map(a => (
          <Link key={a.key} href={`/allergen/${a.key}`} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              aspectRatio: '1',
              borderRadius: '14px',
              border: '1.5px solid #e0e0e0',
              backgroundColor: '#fafafa',
              cursor: 'pointer',
              gap: '6px',
              padding: '8px',
            }}>
              {a.emoji ? (
                <span style={{ fontSize: '32px', lineHeight: 1 }}>{a.emoji}</span>
              ) : (
                <div style={{
                  width: '32px', height: '32px',
                  borderRadius: '8px',
                  border: '1.5px solid #BA7517',
                  backgroundColor: '#FFF0E6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 'bold', color: '#BA7517',
                }}>C</div>
              )}
              <span style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#333',
                textAlign: 'center',
                lineHeight: 1.3,
              }}>{a.label}</span>
            </div>
          </Link>
        ))}
      </div>

    </main>
  )
}