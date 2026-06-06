import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Props = {
  params: { id: string }
}

export default async function MenuDetail({ params }: Props) {
  const { data: menu, error } = await supabase
    .from('menus')
    .select('*')
    .eq('id', params.id)
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

      {/* 戻るリンク */}
      <Link href="/" style={{ fontSize: '13px', color: '#1D9E75' }}>
        ← 一覧に戻る
      </Link>

      {/* 日付 */}
      <p style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>
        {new Date(menu.served_date).toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'long', day: 'numeric'
        })}
      </p>

      {/* 献立名 */}
      <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a1a1a', margin: '6px 0 16px' }}>
        {menu.title}
      </h1>

      {/* 写真 */}
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

      {/* 栄養価テーブル */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ backgroundColor: '#085041', padding: '8px 14px' }}>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>栄養価</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
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
        </table>
      </div>

      {/* 栄養士コメント */}
      <div style={{ backgroundColor: '#f0f7f4', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#085041', marginBottom: '6px' }}>🌿 栄養士より</p>
        <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.7' }}>{menu.nutritionist_comment}</p>
      </div>

      {/* なぜ食べたか */}
      <div style={{ backgroundColor: '#fff8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#BA7517', marginBottom: '6px' }}>🍴 今日の食べっぷり</p>
        <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.7' }}>{menu.why_eat_note}</p>
      </div>

    </main>
  )
}