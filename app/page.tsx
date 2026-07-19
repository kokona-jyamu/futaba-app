'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Menu = {
  id: string
  served_date: string
  title: string
  nutritionist_comment: string
  photo_url: string | null
}

type Event = {
  id: string
  event_date: string
  title: string
  description: string | null
  status: 'upcoming' | 'past'
}

const TABS = ['給食', '食育', 'アレルゲン', '地域だより'] as const
type Tab = typeof TABS[number]

export default function Home() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('給食')
  const [menus, setMenus] = useState<Menu[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  // ログインチェック
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loggedIn = localStorage.getItem('futaba_logged_in')
      if (!loggedIn) router.push('/login')
    }
  }, [router])

  useEffect(() => {
    const fetchData = async () => {
      const { data: menuData } = await supabase
        .from('menus')
        .select('id, served_date, title, nutritionist_comment, photo_url')
        .order('served_date', { ascending: false })
      if (menuData) setMenus(menuData)

      const { data: eventData } = await supabase
        .from('food_education_events')
        .select('*')
        .order('event_date', { ascending: false })
      if (eventData) setEvents(eventData)
    }
    fetchData()
  }, [])

  const menuDates = new Set(menus.map(m => m.served_date))
  const selectedMenus = menus.filter(m => m.served_date === selectedDate)
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

  const upcoming = events.filter(e => e.status === 'upcoming')
  const pastEvents = events.filter(e => e.status === 'past')

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

  return (
    <main style={{ width: '100%', maxWidth: '480px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>

      {/* ヘッダー */}
      <div style={{
        background: 'linear-gradient(135deg, #085041, #1D9E75)',
        padding: '16px 16px 0',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>🌱 ふたば保育園</h1>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>給食・食育ポータル</p>
          </div>
          <button
            onClick={() => { localStorage.removeItem('futaba_logged_in'); router.push('/login') }}
            style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ログアウト
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: '0', scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px', fontSize: '13px', fontWeight: '500',
                whiteSpace: 'nowrap', border: 'none', cursor: 'pointer',
                backgroundColor: 'transparent',
                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.6)',
                borderBottom: activeTab === tab ? '2px solid #fff' : '2px solid transparent',
                flexShrink: 0,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* ===== 給食タブ ===== */}
        {activeTab === '給食' && (
          <>
            {/* カレンダー */}
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', marginBottom: '16px', backgroundColor: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <button onClick={prevMonth} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>‹</button>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a1a1a' }}>{monthLabel}</span>
                <button onClick={nextMonth} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '4px' }}>
                {['日','月','火','水','木','金','土'].map((d, i) => (
                  <div key={d} style={{ fontSize: '11px', color: i === 0 ? '#E24B4A' : i === 6 ? '#378ADD' : '#999', padding: '2px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = formatDate(currentYear, currentMonth, day)
                  const hasMenu = menuDates.has(dateStr)
                  const isToday = dateStr === today
                  const isSelected = dateStr === selectedDate
                  const isSun = (firstDay + i) % 7 === 0
                  const isSat = (firstDay + i) % 7 === 6
                  return (
                    <div key={day} onClick={() => hasMenu && setSelectedDate(isSelected ? null : dateStr)}
                      style={{
                        height: '36px', borderRadius: '50%', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                        cursor: hasMenu ? 'pointer' : 'default', position: 'relative',
                        backgroundColor: isSelected ? '#085041' : hasMenu ? '#E1F5EE' : 'transparent',
                        border: isToday && !isSelected ? '1.5px solid #1D9E75' : 'none',
                        color: isSelected ? '#fff' : hasMenu ? '#085041' : isSun ? '#E24B4A' : isSat ? '#378ADD' : '#555',
                        fontWeight: hasMenu ? 'bold' : 'normal',
                      }}>
                      {day}
                      {hasMenu && <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#fff' : '#1D9E75', position: 'absolute', bottom: '3px' }} />}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#999' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1D9E75', display: 'inline-block' }} />給食あり
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#999' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#085041', display: 'inline-block' }} />選択中
                </div>
              </div>
            </div>

            {/* 選択日の献立 */}
            {selectedDate && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}の給食
                </p>
                {selectedMenus.map(menu => (
                  <Link key={menu.id} href={`/menu/${menu.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a1a1a' }}>{menu.title}</p>
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', lineHeight: '1.5' }}>{menu.nutritionist_comment?.slice(0, 40)}...</p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#1D9E75', marginLeft: '8px', whiteSpace: 'nowrap' }}>詳しく見る →</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* 最近の給食 */}
            {!selectedDate && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>最近の給食</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {menus.slice(0, 3).map(menu => (
                    <Link key={menu.id} href={`/menu/${menu.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', backgroundColor: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
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
          </>
        )}

        {/* ===== 食育タブ ===== */}
        {activeTab === '食育' && (
          <div>
            {/* 次回イベント予告 */}
            {upcoming.length > 0 && (
              <div style={{ backgroundColor: '#FFF8F0', border: '1px solid #FAC775', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: '#BA7517', color: '#fff', padding: '2px 8px', borderRadius: '10px', marginBottom: '6px', display: 'inline-block' }}>次回予告</span>
                <p style={{ fontSize: '11px', color: '#BA7517', marginTop: '4px', marginBottom: '2px' }}>
                  {new Date(upcoming[0].event_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                </p>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{upcoming[0].title}</p>
              </div>
            )}

            {/* サブメニュー */}
            <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>食育メニュー</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: '📷 食育のあしあと（記録）', href: '/food-education' },
                { label: '🍳 家でやる食育・レシピ', href: '/food-education' },
              ].map(item => (
                <Link key={item.href + item.label} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px 16px', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#333' }}>{item.label}</span>
                    <span style={{ fontSize: '13px', color: '#1D9E75' }}>→</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* 過去の食育記録プレビュー */}
            {pastEvents.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>最近の食育活動</p>
                {pastEvents.slice(0, 2).map(e => (
                  <div key={e.id} style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '12px 14px', backgroundColor: '#fff', marginBottom: '8px' }}>
                    <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                      {new Date(e.event_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{e.title}</p>
                  </div>
                ))}
                <Link href="/food-education" style={{ textDecoration: 'none' }}>
                  <p style={{ fontSize: '13px', color: '#1D9E75', textAlign: 'center', marginTop: '8px' }}>すべて見る →</p>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ===== アレルゲンタブ ===== */}
        {activeTab === 'アレルゲン' && (
          <div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              気になるアレルゲンをタップして献立を検索できます
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {ALLERGENS.map(a => (
                <Link key={a.key} href={`/allergen/${a.key}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    aspectRatio: '1', borderRadius: '14px', border: '1.5px solid #e0e0e0',
                    backgroundColor: '#fff', cursor: 'pointer', gap: '6px', padding: '8px',
                  }}>
                    {a.emoji ? (
                      <span style={{ fontSize: '32px', lineHeight: 1 }}>{a.emoji}</span>
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #BA7517', backgroundColor: '#FFF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', color: '#BA7517' }}>C</div>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#333', textAlign: 'center' }}>{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ===== 地域だよりタブ ===== */}
        {activeTab === '地域だより' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏘️</div>
            <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>地域だより</p>
            <p style={{ fontSize: '13px', color: '#999' }}>地域のお店・施設の最新情報を<br />ここでお届けする予定です</p>
            <p style={{ fontSize: '12px', color: '#bbb', marginTop: '16px' }}>（準備中）</p>
          </div>
        )}

      </div>
    </main>
  )
}