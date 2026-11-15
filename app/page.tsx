/* app/page.tsx — 保護者のトップ
 *
 * 開くと「ホーム」：いちばん上に今日のおやすみ・遅刻の連絡、その下に各メニュー（給食・食育・アレルゲン・地域だより）。
 * メニューを押すとその画面に切り替わり、上のタブ（ホームを含む）で行き来できる。
 */
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/menu'
import AllergenTiles from '@/components/AllergenTiles'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGuardian } from '@/lib/useGuardian'
import { initialOf } from '@/lib/guardian'
import { phaseOf, isAhead } from '@/lib/eventStatus'
import { STATUS_LABEL, type AttendanceStatus } from '@/lib/attendance'
import { todayStr, nowJST, monthEnd } from '@/lib/date'
import type { Tables } from '@/lib/database.types'
import type { Attendance, EventsResponse, FoodEvent } from '@/lib/apiTypes'
import { fetchJson } from '@/lib/useLoadEffect'

/* 一覧に使う列だけを DB の型から取り出す */
type Menu = Pick<Tables<'menus'>, 'id' | 'served_date' | 'title' | 'nutritionist_comment'>

const TABS = ['ホーム', '給食', '食育', 'アレルゲン', '地域だより'] as const
type Tab = (typeof TABS)[number]

/** ホームのメニュー（ホーム以外の画面） */
const MENU_TABS = TABS.filter((t): t is Exclude<Tab, 'ホーム'> => t !== 'ホーム')

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function Home() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('ホーム')
  const [menus, setMenus] = useState<Menu[]>([])
  const [events, setEvents] = useState<FoodEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  /* currentMonth は 0〜11（カレンダー描画用） */
  const [currentYear, setCurrentYear] = useState(() => nowJST().year)
  const [currentMonth, setCurrentMonth] = useState(() => nowJST().month - 1)
  const [upcomingAtt, setUpcomingAtt] = useState<Attendance[]>([])
  const { child, guardian } = useGuardian()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
    })
  }, [router])

  /* 献立と食育は、保護者の園のものだけを読む */
  const schoolId = guardian?.school_id
  useEffect(() => {
    if (!schoolId) return
    const fetchData = async () => {
      const { data: menuData } = await supabase
        .from('menus')
        .select('id, served_date, title, nutritionist_comment')
        .eq('school_id', schoolId)
        .order('served_date', { ascending: false })
      if (menuData) setMenus(menuData)

      /* 食育はサーバーから読む（写真は園の関係者だけが見られる場所にあるため） */
      const r = await fetchJson<EventsResponse>('/api/events')
      if (r.ok) setEvents(r.json.events)
    }
    fetchData()
  }, [schoolId])

  /* これから先の出欠連絡（トップに出すため） */
  useEffect(() => {
    if (!guardian) return
    const fetchAttendance = async () => {
      /* 今日から来月末まで */
      const today = todayStr()
      const res = await fetch(`/api/attendance?from=${today}&to=${monthEnd(today, 1)}`)
      const json = await res.json()
      if (res.ok) setUpcomingAtt(json.attendances)
    }
    fetchAttendance()
  }, [guardian])

  const menuDates = new Set(menus.map((m) => m.served_date))
  const selectedMenus = menus.filter((m) => m.served_date === selectedDate)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const today = todayStr()
  const monthLabel = `${currentYear}年${currentMonth + 1}月`

  /* 出欠を連絡している日（カレンダーに印を出す） */
  const attByDate = new Map(upcomingAtt.map((a) => [a.target_date, a]))
  const todayAtt = attByDate.get(today)

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

  const go = (tab: Tab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0 })
  }

  /** 今日の給食（公開済みのものだけ読めている） */
  const todayMenu = menus.find((m) => m.served_date === today)

  const upcoming = events
    .filter(isAhead)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  const pastEvents = events.filter((e) => phaseOf(e.event_date) === 'past')

  return (
    <>
      <header className="fa-topbar">
        <div className="fa-topbar-inner">
          <div className="fa-topbar-row">
            <button type="button" className="fa-brandbtn" onClick={() => go('ホーム')}>
              <span className="fa-brand">ふたば保育園</span>
              <span className="fa-brandsub">給食・食育ポータル</span>
            </button>
            <Link href="/mypage" className="fa-avatarbtn">
              <span className="fa-avatar">{initialOf(child?.name)}</span>
              <span className="fa-avatarbtn-name">
                {child?.name ?? 'マイページ'}
              </span>
            </Link>
          </div>

          {/* ホームでは、メニューから各画面へ入るのでタブを出さない */}
          {activeTab !== 'ホーム' && (
            <nav className="fa-navtabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={`fa-navtab${activeTab === tab ? ' is-on' : ''}`}
                  onClick={() => go(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="fa-page">

        <div className="fa-panel-area">

          {/* ===== ホーム ===== */}
          {activeTab === 'ホーム' && (
            <div>
              {/* おやすみ・遅刻の連絡（いちばん上） */}
              <section className={`fa-card fa-pattcard${todayAtt ? ' is-reported' : ''}`}>
                <p className="fa-pattcard-date">{formatDate(today)}</p>
                <p className="fa-pattcard-title">
                  {todayAtt
                    ? `今日は「${STATUS_LABEL[todayAtt.status as AttendanceStatus]}」で連絡ずみです`
                    : 'おやすみ・遅刻の連絡'}
                </p>
                <p className="fa-pattcard-sub">
                  {upcomingAtt.length > 0
                    ? `この先${upcomingAtt.length}日分の連絡があります。確認・取り消しも同じ画面からできます。`
                    : 'お休みや遅刻のときは、こちらから園にお知らせください。'}
                </p>
                <Link href="/attendance" className="fa-btn fa-btn--primary fa-pattcard-btn">
                  {todayAtt ? '連絡を確認・変更する' : 'おやすみ・遅刻を連絡する'}
                </Link>
              </section>

              <h2 className="fa-subtitle">メニュー</h2>
              <div className="fa-pmenu">
                {MENU_TABS.map((tab) => (
                  <button key={tab} type="button" onClick={() => go(tab)} className="fa-pmenu-item">
                    <span className="fa-pmenu-label">{tab}</span>
                    <span className="fa-pmenu-sub">
                      {tab === '給食' && (todayMenu ? `今日：${todayMenu.title}` : '献立と写真をカレンダーで見る')}
                      {tab === '食育' && (upcoming[0]
                        ? `次回：${formatDate(upcoming[0].event_date)} ${upcoming[0].title}`
                        : '食育の記録とおうちでできるレシピ')}
                      {tab === 'アレルゲン' && '使っていない献立を探す'}
                      {tab === '地域だより' && '準備中'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                    const att = attByDate.get(dateStr)
                    const cls = [
                      'fa-day',
                      hasMenu ? 'has-menu' : '',
                      isSelected ? 'is-selected' : '',
                      dateStr === today && !isSelected ? 'is-today' : '',
                      !hasMenu && weekday === 0 ? 'is-sun' : '',
                      !hasMenu && weekday === 6 ? 'is-sat' : '',
                      att ? 'is-off' : '',
                    ].filter(Boolean).join(' ')

                    return (
                      <button
                        key={day}
                        className={cls}
                        disabled={!hasMenu}
                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                        title={att ? STATUS_LABEL[att.status as AttendanceStatus] : undefined}
                      >
                        {day}
                        {hasMenu && !att && <span className="fa-dot" />}
                        {att && (
                          <span className="fa-offmark">
                            {att.status === 'absent' ? '休' : '遅'}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="fa-legend">
                  <span className="fa-legend-item">
                    <span className="fa-legend-dot" style={{ background: 'var(--fa-brand)' }} />給食あり
                  </span>
                  <span className="fa-legend-item">
                    <span className="fa-legend-dot" style={{ background: 'var(--fa-brand-deep)' }} />選択中
                  </span>
                  {upcomingAtt.length > 0 && (
                    <span className="fa-legend-item">
                      <span className="fa-legend-dot" style={{ background: 'var(--fa-apricot)' }} />連絡ずみ
                    </span>
                  )}
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
                  { label: '食育のあしあと（記録）', href: '/food-education' },
                  { label: '家でやる食育・レシピ', href: '/food-education?tab=recipes' },
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
              <AllergenTiles />
            </div>
          )}

          {/* ===== 地域だより ===== */}
          {activeTab === '地域だより' && (
            <div className="fa-soon">
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