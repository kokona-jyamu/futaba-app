import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Menu = {
  id: string
  served_date: string
  title: string
  nutritionist_comment: string
  photo_url: string | null
  kcal: number | null
  carb: number | null
  protein: number | null
  fat: number | null
  salt: number | null
  calcium: number | null
}

export default async function Home() {
  // Supabaseから献立を取得（新しい順）
  const { data: menus, error } = await supabase
  .from('menus')
  .select('*')
  .order('served_date', { ascending: false })
  .returns<Menu[]>()

  if (error) {
    return <p style={{ padding: '1rem' }}>データの取得に失敗しました</p>
  }
  

  return (
    <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#085041' }}>
          🌱 ふたば保育園 給食だより
        </h1>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
          今日の給食をお届けします
        </p>
      </div>

      {/* 献立カード一覧 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {menus && menus.map((menu) => (
          <Link
            key={menu.id}
            href={`/menu/${menu.id}`}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              padding: '14px',
              backgroundColor: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              {/* 日付 */}
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                {new Date(menu.served_date).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>

              {/* 献立名 */}
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '8px' }}>
                {menu.title}
              </h2>

              {/* 写真プレースホルダー */}
              {menu.photo_url ? (
                <img
                  src={menu.photo_url}
                  alt={menu.title}
                  style={{ width: '100%', borderRadius: '8px', marginBottom: '8px', objectFit: 'cover', height: '160px' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100px', borderRadius: '8px',
                  backgroundColor: '#f0f7f4', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: '8px', color: '#9FE1CB', fontSize: '13px'
                }}>
                  🍽 写真準備中
                </div>
              )}

              {/* 栄養士コメント */}
              <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.6' }}>
                {menu.nutritionist_comment}
              </p>

              {/* タップ誘導 */}
              <p style={{ fontSize: '12px', color: '#1D9E75', marginTop: '8px', textAlign: 'right' }}>
                詳しく見る →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}