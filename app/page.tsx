'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Menu = {
  id: string
  served_date: string
  title: string
  nutritionist_comment: string
  photo_url: string | null
}

export default function Home() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('menus')
        .select('id, served_date, title, nutritionist_comment, photo_url')
        .order('served_date', { ascending: false })
      if (data) setMenus(data)
    }
    fetch()
  }, [])

  // 献立がある日付のSet
  const menuDates = new Set(menus.map(m => m.served_date))

  // 選択日の献立
  const selectedMenus = menus.filter(m => m.served_date === selectedDate)

  // カレンダー生成
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  const monthLabel = `${currentYear}年${currentMonth + 1}月`

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
    setSelectedDate(null)
  }

  const formatDate = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>

      {/* ヘッダー */}
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#085041' }}>
          🌱 ふたば保育園 給食だより
        </h1>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
          今日の給食をお届けします
        </p>
      </div>

      <Link href="/food-education" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#FFF8F0', border: '1px solid #FAC775',
          borderRadius: '10px', padding: '10px 14px', marginTop: '12px', marginBottom: '4px',
        }}>
          <span style={{ fontSize: '13px', color: '#BA7517', fontWeight: 'bold' }}>🌾 食育のあしあと</span>
          <span style={{ fontSize: '12px', color: '#BA7517' }}>見る →</span>
        </div>
      </Link>

      <Link href="/allergen" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#FFF0E6', border: '1px solid #FAC775',
          borderRadius: '10px', padding: '10px 14px', marginTop: '8px', marginBottom: '4px',
        }}>
          <span style={{ fontSize: '13px', color: '#BA7517', fontWeight: 'bold' }}>🔍 アレルゲン別献立を探す</span>
          <span style={{ fontSize: '12px', color: '#BA7517' }}>見る →</span>
        </div>
      </Link>

      {/* カレンダー */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', marginBottom: '16px', backgroundColor: '#fff' }}>

        {/* 月ナビ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <button onClick={prevMonth} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '0 8px' }}>‹</button>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a1a1a' }}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '0 8px' }}>›</button>
        </div>

        {/* 曜日ヘッダー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '4px' }}>
          {['日','月','火','水','木','金','土'].map((d, i) => (
            <div key={d} style={{ fontSize: '11px', color: i === 0 ? '#E24B4A' : i === 6 ? '#378ADD' : '#999', padding: '2px 0' }}>{d}</div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {/* 空白 */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {/* 日付 */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = formatDate(currentYear, currentMonth, day)
            const hasMenu = menuDates.has(dateStr)
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const isSun = (firstDay + i) % 7 === 0
            const isSat = (firstDay + i) % 7 === 6

            return (
              <div
                key={day}
                onClick={() => hasMenu && setSelectedDate(isSelected ? null : dateStr)}
                style={{
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  cursor: hasMenu ? 'pointer' : 'default',
                  position: 'relative',
                  backgroundColor: isSelected ? '#085041' : hasMenu ? '#E1F5EE' : 'transparent',
                  border: isToday && !isSelected ? '1.5px solid #1D9E75' : 'none',
                  color: isSelected ? '#fff' : hasMenu ? '#085041' : isSun ? '#E24B4A' : isSat ? '#378ADD' : '#555',
                  fontWeight: hasMenu ? 'bold' : 'normal',
                }}
              >
                {day}
                {hasMenu && (
                  <span style={{
                    width: '4px', height: '4px', borderRadius: '50%',
                    backgroundColor: isSelected ? '#fff' : '#1D9E75',
                    position: 'absolute', bottom: '3px'
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#999' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1D9E75', display: 'inline-block' }} />
            給食あり
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#999' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#085041', display: 'inline-block' }} />
            選択中
          </div>
        </div>
      </div>

      {/* 選択日の献立 */}
      {selectedDate && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}の給食
          </p>
          {selectedMenus.length > 0 ? selectedMenus.map(menu => (
            <Link key={menu.id} href={`/menu/${menu.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px',
                backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a1a1a' }}>{menu.title}</p>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', lineHeight: '1.5' }}>{menu.nutritionist_comment?.slice(0, 40)}...</p>
                </div>
                <p style={{ fontSize: '12px', color: '#1D9E75', marginLeft: '8px', whiteSpace: 'nowrap' }}>詳しく見る →</p>
              </div>
            </Link>
          )) : (
            <p style={{ fontSize: '13px', color: '#999' }}>この日の献立はありません</p>
          )}
        </div>
      )}

      {/* 選択前：最新献立一覧 */}
      {!selectedDate && (
        <div>
          <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>最近の給食</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {menus.slice(0, 3).map(menu => (
              <Link key={menu.id} href={`/menu/${menu.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px',
                  backgroundColor: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                  <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                    {new Date(menu.served_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                  </p>
                  <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '6px' }}>{menu.title}</p>
                  <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.6' }}>{menu.nutritionist_comment}</p>
                  <p style={{ fontSize: '12px', color: '#1D9E75', marginTop: '8px', textAlign: 'right' }}>詳しく見る →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </main>
  )
}