import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import MessageSection from '@/components/MessageSection'

type Props = {
  params: Promise<{ id: string }>
}

export default async function MenuDetail({ params }: Props) {
  const { id } = await params

  const { data: menu, error } = await supabase
    .from('menus')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !menu) {
    return (
      <main style={{ padding: '1rem' }}>
        <p>献立が見つかりませんでした</p>
        <Link href="/">← 一覧に戻る</Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>

      <Link href="/" style={{ fontSize: '13px', color: '#1D9E75' }}>
        ← 一覧に戻る
      </Link>

      <p style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>
        {new Date(menu.served_date).toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'long', day: 'numeric'
        })}
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a1a1a', margin: '6px 0 16px' }}>
        {menu.title}
      </h1>

      {menu.photo_url ? (
        <img
          src={menu.photo_url}
          alt={menu.title}
          style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', objectFit: 'cover', height: '200px' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '160px', borderRadius: '12px',
          backgroundColor: '#f0f7f4', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px', color: '#9FE1CB', fontSize: '14px'
        }}>
          🍽 写真準備中
        </div>
      )}

      <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ backgroundColor: '#085041', padding: '8px 14px' }}>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>栄養価</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            {[
              { label: 'エネルギー', value: menu.kcal,    unit: 'kcal' },
              { label: '炭水化物',   value: menu.carb,    unit: 'g' },
              { label: 'タンパク質', value: menu.protein, unit: 'g' },
              { label: '脂質',       value: menu.fat,     unit: 'g' },
              { label: '食塩相当量', value: menu.salt,    unit: 'g' },
              { label: 'カルシウム', value: menu.calcium, unit: 'mg' },
            ].map((row, i) => (
              <tr key={row.label} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td style={{ padding: '8px 14px', color: '#555', borderBottom: '1px solid #f0f0f0' }}>{row.label}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: '#1a1a1a', fontWeight: '500', borderBottom: '1px solid #f0f0f0' }}>
                  {row.value ?? '—'} {row.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>
          ⚠️ アレルギー情報（特定原材料8品目）
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { key: 'egg',       label: '卵',     emoji: '🥚' },
            { key: 'milk',      label: '乳',     emoji: '🥛' },
            { key: 'wheat',     label: '小麦',   emoji: '🌾' },
            { key: 'buckwheat', label: 'そば',   emoji: '🍜' },
            { key: 'peanut',    label: '落花生', emoji: '🥜' },
            { key: 'shrimp',    label: 'えび',   emoji: '🦐' },
            { key: 'crab',      label: 'かに',   emoji: '🦀' },
            { key: 'walnut',    label: 'くるみ', emoji: '🌰' },
            { key: 'cashew',    label: 'カシューナッツ', emoji: 'c' },
          ].map(a => {
            const allergens = menu.allergens as { [key: string]: boolean } | null
            const active = allergens?.[a.key] === true
            return (
              <div key={a.key} style={{
                width: '48px', height: '48px', borderRadius: '50%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: active ? '#FFF0E6' : '#f0f0f0',
                border: `2px solid ${active ? '#BA7517' : '#e0e0e0'}`,
                opacity: active ? 1 : 0.4,
              }}>
                <span style={{ fontSize: '18px' }}>{a.emoji}</span>
                <span style={{ fontSize: '9px', color: active ? '#BA7517' : '#999', fontWeight: active ? 'bold' : 'normal', marginTop: '1px' }}>
                  {a.label}
                </span>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
          色付きの項目が含まれています。グレーは不使用。
        </p>
      </div>

      <div style={{ backgroundColor: '#f0f7f4', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#085041', marginBottom: '6px' }}>🌿 栄養士より</p>
        <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.7' }}>{menu.nutritionist_comment}</p>
      </div>

      <div style={{ backgroundColor: '#fff8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#BA7517', marginBottom: '6px' }}>🍴 今日の食べっぷり</p>
        <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.7' }}>{menu.why_eat_note}</p>
      </div>

      {/* メッセージセクション */}
      <MessageSection menuId={menu.id} />

    </main>
  )
}