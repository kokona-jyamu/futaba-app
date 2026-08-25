/* app/food-education/page.tsx
 *
 * 予告と記録の区別は event_date で判定する。
 * status 列は使わない（切り替え忘れで予告が残る事故を防ぐため）。
 */
'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/menu'
import { phaseOf } from '@/lib/eventStatus'
import Link from 'next/link'

type Event = {
  id: string
  event_date: string
  title: string
  description: string | null
  photo_url: string | null
  recipe_title: string | null
  recipe_ingredients: string[] | null
  recipe_steps: string | null
}

export default function FoodEducationPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [tab, setTab] = useState<'records' | 'recipes'>('records')
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({})
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set())

  const visitorId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    let id = window.localStorage.getItem('visitor_id')
    if (!id) {
      id = 'visitor_' + Math.random().toString(36).slice(2, 10)
      window.localStorage.setItem('visitor_id', id)
    }
    return id
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'recipes') {
      setTab('recipes')
    }
  }, [])

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('food_education_events')
        .select('*')
        .order('event_date', { ascending: false })
      if (data) setEvents(data)
    }
    fetchEvents()
  }, [])

  const fetchLikes = useCallback(async () => {
    if (!visitorId) return
    const { data } = await supabase.from('event_likes').select('*')
    if (!data) return
    const counts: { [key: string]: number } = {}
    const mine = new Set<string>()
    data.forEach((like) => {
      counts[like.event_id] = (counts[like.event_id] || 0) + 1
      if (like.liked_by === visitorId) mine.add(like.event_id)
    })
    setLikeCounts(counts)
    setMyLikes(mine)
  }, [visitorId])

  useEffect(() => { fetchLikes() }, [fetchLikes])

  const toggleLike = async (eventId: string) => {
    const liked = myLikes.has(eventId)

    setMyLikes((prev) => {
      const next = new Set(prev)
      liked ? next.delete(eventId) : next.add(eventId)
      return next
    })
    setLikeCounts((prev) => ({
      ...prev,
      [eventId]: Math.max((prev[eventId] || 0) + (liked ? -1 : 1), 0),
    }))

    const { error } = liked
      ? await supabase.from('event_likes').delete()
          .eq('event_id', eventId).eq('liked_by', visitorId)
      : await supabase.from('event_likes')
          .insert({ event_id: eventId, liked_by: visitorId })

    if (error) {
      setMyLikes((prev) => {
        const next = new Set(prev)
        liked ? next.add(eventId) : next.delete(eventId)
        return next
      })
      setLikeCounts((prev) => ({
        ...prev,
        [eventId]: Math.max((prev[eventId] || 0) + (liked ? 1 : -1), 0),
      }))
    }
  }

  /* 日付で振り分ける */
  const upcoming = events.filter((e) => phaseOf(e.event_date) === 'upcoming')
  const today = events.filter((e) => phaseOf(e.event_date) === 'today')
  const past = events.filter((e) => phaseOf(e.event_date) === 'past')
  const withRecipe = events.filter((e) => e.recipe_title)

  return (
    <main className="fa-page">
      <Link href="/" className="fa-back">← 給食だよりに戻る</Link>

      <div className="fa-pagehead">
        <h1 className="fa-title">🌾 食育のあしあと</h1>
        <p className="fa-lead">ふたば保育園の食育活動の記録と、おうちで試せるレシピです。</p>
      </div>

      <nav className="fa-tabs" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="tablist">
        <button
          role="tab" aria-selected={tab === 'records'}
          className={`fa-tab${tab === 'records' ? ' is-on' : ''}`}
          onClick={() => setTab('records')}
        >
          <span className="fa-tab-icon">📷</span>記録・予告
        </button>
        <button
          role="tab" aria-selected={tab === 'recipes'}
          className={`fa-tab${tab === 'recipes' ? ' is-on' : ''}`}
          onClick={() => setTab('recipes')}
        >
          <span className="fa-tab-icon">🍳</span>家でやる食育
          {withRecipe.length > 0 && <span className="fa-badge">{withRecipe.length}</span>}
        </button>
      </nav>

      <div className="fa-panel-area" style={{ marginTop: 20 }}>

        {/* ---------- 記録・予告 ---------- */}
        {tab === 'records' && (
          <>
            {/* 本日開催 */}
            {today.length > 0 && (
              <>
                <h2 className="fa-subtitle">🎉 本日の食育イベント</h2>
                <div className="fa-grid fa-grid--2">
                  {today.map((e) => (
                    <div key={e.id} className="fa-notice fa-notice--today">
                      <span className="fa-pill fa-pill--today">本日開催</span>
                      <p className="fa-notice-date">{formatDate(e.event_date)}</p>
                      <p className="fa-notice-title">{e.title}</p>
                      {e.description && <p className="fa-notice-body">{e.description}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* これからの予告 */}
            {upcoming.length > 0 && (
              <>
                <h2 className="fa-subtitle">📅 次回の食育イベント</h2>
                <div className="fa-grid fa-grid--2">
                  {upcoming.map((e) => (
                    <div key={e.id} className="fa-notice">
                      <span className="fa-pill">予告</span>
                      <p className="fa-notice-date">{formatDate(e.event_date)}</p>
                      <p className="fa-notice-title">{e.title}</p>
                      {e.description && <p className="fa-notice-body">{e.description}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* これまでの記録 */}
            {past.length > 0 && (
              <>
                <h2 className="fa-subtitle">📷 これまでの食育のあしあと</h2>
                <div className="fa-grid">
                  {past.map((e) => (
                    <article key={e.id} className="fa-event">
                      {e.photo_url ? (
                        <img src={e.photo_url} alt={e.title} className="fa-event-photo" />
                      ) : (
                        <div className="fa-event-photo--empty">🌾 写真準備中</div>
                      )}
                      <div className="fa-event-body">
                        <p className="fa-date">{formatDate(e.event_date)}</p>
                        <p className="fa-event-title">{e.title}</p>
                        {e.description && <p className="fa-event-text">{e.description}</p>}

                        <div className="fa-event-foot">
                          <button
                            onClick={() => toggleLike(e.id)}
                            className={`fa-like${myLikes.has(e.id) ? ' is-on' : ''}`}
                            aria-label={myLikes.has(e.id) ? 'いいねを取り消す' : 'いいねする'}
                          >
                            <span className="fa-like-icon">{myLikes.has(e.id) ? '❤️' : '🤍'}</span>
                            <span className="fa-like-count">{likeCounts[e.id] || 0}</span>
                          </button>

                          {e.recipe_title && (
                            <button onClick={() => setTab('recipes')} className="fa-textlink">
                              🍳 家でも作れるレシピを見る →
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {events.length === 0 && (
              <p className="fa-empty">まだ食育の記録がありません。</p>
            )}
          </>
        )}

        {/* ---------- 家でやる食育 ---------- */}
        {tab === 'recipes' && (
          <>
            {withRecipe.length === 0 && (
              <p className="fa-empty">まだレシピの登録がありません。</p>
            )}
            <div className="fa-grid fa-grid--2">
              {withRecipe.map((e) => (
                <article key={e.id} className="fa-recipe">
                  <p className="fa-recipe-from">{e.title}より</p>
                  <p className="fa-recipe-title">🍳 {e.recipe_title}</p>

                  {e.recipe_ingredients && e.recipe_ingredients.length > 0 && (
                    <>
                      <p className="fa-recipe-h">材料</p>
                      <p className="fa-recipe-ing">{e.recipe_ingredients.join('　')}</p>
                    </>
                  )}

                  {e.recipe_steps && (
                    <div className="fa-recipe-steps">
                      <p className="fa-recipe-h">作り方</p>
                      <p>{e.recipe_steps}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}