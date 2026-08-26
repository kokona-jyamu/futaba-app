/* app/page.tsx */
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ALLERGENS, SCHOOL_ID, formatDate } from '@/lib/menu'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGuardian } from '@/lib/useGuardian'
import { initialOf } from '@/lib/guardian'
import { phaseOf, isAhead } from '@/lib/eventStatus'

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
type Tab = (typeof TABS)[number]

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function Home() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('給食')
  const [menus, setMenus] = useState<Menu[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const { child } = useGuardian()

useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
    })
  }, [router])

  useEffect(() => {
    const fetchData = async () => {
      const { data: menuData } = await supabase
        .from('menus')
        .select('id, served_date, title, nutritionist_comment, photo_url')
        .eq('school_id', SCHOOL_ID)
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

  const menuDates = new Set(menus.map((m) => m.served_date))
  const selectedMenus = menus.filter((m) => m.served_date === selectedDate)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const today = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const monthLabel = `${currentYear}年${currentMonth + 1}月`

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1) }
    else setCurrentMonth((m) => m - 1)
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1) }
    else setCurrentMonth((m) => m + 1)
    setSelectedDate(null)
  }

  const upcoming = events
    .filter(isAhead)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  const pastEvents = events.filter((e) => phaseOf(e.event_date) === 'past')
  
  return (
    <>
      <header className="fa-topbar">
        <div className="fa-topbar-inner">
          <div className="fa-topbar-row">
            <div>
              <p className="fa-brand">🌱 ふたば保育園</p>
              <p className="fa-brandsub">給食・食育ポータル</p>
            </div>
            <Link href="/mypage" className="fa-avatarbtn">
              <span className="fa-avatar">{initialOf(child?.name)}</span>
              <span className="fa-avatarbtn-name">
                {child?.name ?? 'マイページ'}
              </span>
            </Link>
          </div>

          <nav className="fa-navtabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`fa-navtab${activeTab === tab ? ' is-on' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="fa-page">
        <div className="fa-panel-area">

          {/* ===== 給食 ===== */}
          {activeTab === '給食' && (
            <div className="fa-cal-layout">
              <section className="fa-cal">
                <div className="fa-cal-head">
                  <button onClick={prevMonth} className="fa-cal-nav" aria-label="前の月">‹</button>
                  <span className="fa-cal-month">{monthLabel}</span>
                  <button onClick={nextMonth} className="fa-cal-nav" aria-label="次の月">›</button>
                </div>

                <div className="fa-cal-week">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                    <div key={d} className={`fa-cal-wd${i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''}`}>{d}</div>
                  ))}
                </div>

                <div className="fa-cal-grid">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dateStr = toDateStr(currentYear, currentMonth, day)
                    const hasMenu = menuDates.has(dateStr)
                    const isSelected = dateStr === selectedDate
                    const weekday = (firstDay + i) % 7
                    const cls = [
                      'fa-day',
                      hasMenu ? 'has-menu' : '',
                      isSelected ? 'is-selected' : '',
                      dateStr === today && !isSelected ? 'is-today' : '',
                      !hasMenu && weekday === 0 ? 'is-sun' : '',
                      !hasMenu && weekday === 6 ? 'is-sat' : '',
                    ].filter(Boolean).join(' ')

                    return (
                      <button
                        key={day}
                        className={cls}
                        disabled={!hasMenu}
                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      >
                        {day}
                        {hasMenu && <span className="fa-dot" />}
                      </button>
                    )
                  })}
                </div>

                <div className="fa-legend">
                  <span className="fa-legend-item">
                    <span className="fa-legend-dot" style={{ background: 'var(--fa-matcha)' }} />給食あり
                  </span>
                  <span className="fa-legend-item">
                    <span className="fa-legend-dot" style={{ background: 'var(--fa-matcha-deep)' }} />選択中
                  </span>
                </div>
              </section>

              <section>
                <h2 className="fa-subtitle">
                  {selectedDate ? `${formatDate(selectedDate)}の給食` : '最近の給食'}
                </h2>

                {selectedDate && selectedMenus.length === 0 && (
                  <p className="fa-empty">この日の献立はまだ登録されていません。</p>
                )}

                <div className="fa-grid fa-grid--2">
                  {(selectedDate ? selectedMenus : menus.slice(0, 6)).map((menu) => (
                    <Link key={menu.id} href={`/menu/${menu.id}`} className="fa-link">
                      <article className="fa-linkcard">
                        <p className="fa-date">{formatDate(menu.served_date)}</p>
                        <p className="fa-linktitle">{menu.title}</p>
                        {menu.nutritionist_comment && (
                          <p className="fa-linktext">{menu.nutritionist_comment}</p>
                        )}
                        <p className="fa-more">詳しく見る →</p>
                      </article>
                    </Link>
                  ))}
                </div>

                {!selectedDate && menus.length === 0 && (
                  <p className="fa-empty">まだ献立が登録されていません。</p>
                )}
              </section>
            </div>
          )}

          {/* ===== 食育 ===== */}
          {activeTab === '食育' && (
            <div>
              {upcoming.length > 0 && (
                <div
                  className={`fa-notice${phaseOf(upcoming[0].event_date) === 'today' ? ' fa-notice--today' : ''}`}
                  style={{ marginBottom: 20 }}
                >
                  <span className={`fa-pill${phaseOf(upcoming[0].event_date) === 'today' ? ' fa-pill--today' : ''}`}>
                    {phaseOf(upcoming[0].event_date) === 'today' ? '本日開催' : '次回予告'}
                  </span>
                  <p className="fa-notice-date">{formatDate(upcoming[0].event_date)}</p>
                  <p className="fa-notice-title">{upcoming[0].title}</p>
                </div>
              )}

              <h2 className="fa-subtitle">食育メニュー</h2>
              <div className="fa-rows">
                {[
                  { label: '📷 食育のあしあと（記録）', href: '/food-education' },
                  { label: '🍳 家でやる食育・レシピ', href: '/food-education?tab=recipes' },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="fa-link">
                    <div className="fa-row">
                      <span className="fa-rowlabel">{item.label}</span>
                      <span className="fa-rowarrow">→</span>
                    </div>
                  </Link>
                ))}
              </div>

              {pastEvents.length > 0 && (
                <>
                  <h2 className="fa-subtitle">最近の食育活動</h2>
                  <div className="fa-grid">
                    {pastEvents.slice(0, 3).map((e) => (
                      <div key={e.id} className="fa-linkcard">
                        <p className="fa-date">{formatDate(e.event_date)}</p>
                        <p className="fa-linktitle">{e.title}</p>
                        {e.description && <p className="fa-linktext">{e.description}</p>}
                      </div>
                    ))}
                  </div>
                  <Link href="/food-education" className="fa-link">
                    <p className="fa-more" style={{ textAlign: 'center', marginTop: 14 }}>
                      すべて見る →
                    </p>
                  </Link>
                </>
              )}
            </div>
          )}

          {/* ===== アレルゲン ===== */}
          {activeTab === 'アレルゲン' && (
            <div>
              <p className="fa-lead" style={{ marginBottom: 16 }}>
                気になるアレルゲンをタップすると、それを使っていない献立を絞り込めます。
              </p>
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
            </div>
          )}

          {/* ===== 地域だより ===== */}
          {activeTab === '地域だより' && (
            <div className="fa-soon">
              <p className="fa-soon-icon">🏘️</p>
              <p className="fa-soon-title">地域だより</p>
              <p className="fa-soon-text">
                地域のお店・施設の最新情報を<br />ここでお届けする予定です。
              </p>
              <p className="fa-soon-text" style={{ marginTop: 16, opacity: .7 }}>（準備中）</p>
            </div>
          )}

        </div>
      </main>
    </>
  )
}