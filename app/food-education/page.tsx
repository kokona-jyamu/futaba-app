'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Event = {
  id: string
  event_date: string
  title: string
  description: string | null
  photo_url: string | null
  status: 'upcoming' | 'past'
  recipe_title: string | null
  recipe_ingredients: string[] | null
  recipe_steps: string | null
}

export default function FoodEducationPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [tab, setTab] = useState<'records' | 'recipes'>('records')
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null)
  const [likedEvents, setLikedEvents] = useState<{[key: string]: number}>({})
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
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('food_education_events')
        .select('*')
        .order('event_date', { ascending: false })
      if (data) setEvents(data)
    }
    fetchEvents()
  }, [])

  useEffect(() => {
    const fetchLikes = async () => {
      const { data } = await supabase.from('event_likes').select('*')
      if (data) {
        const counts: {[key: string]: number} = {}
        const mine = new Set<string>()
        data.forEach(like => {
          counts[like.event_id] = (counts[like.event_id] || 0) + 1
          if (like.liked_by === visitorId) mine.add(like.event_id)
        })
        setLikedEvents(counts)
        setMyLikes(mine)
      }
    }
    if (visitorId) fetchLikes()
  }, [visitorId])

  const toggleLike = async (eventId: string) => {
    if (myLikes.has(eventId)) {
      await supabase.from('event_likes').delete().eq('event_id', eventId).eq('liked_by', visitorId)
      setMyLikes(prev => { const next = new Set(prev); next.delete(eventId); return next })
      setLikedEvents(prev => ({ ...prev, [eventId]: Math.max((prev[eventId] || 1) - 1, 0) }))
    } else {
      await supabase.from('event_likes').insert({ event_id: eventId, liked_by: visitorId })
      setMyLikes(prev => new Set(prev).add(eventId))
      setLikedEvents(prev => ({ ...prev, [eventId]: (prev[eventId] || 0) + 1 }))
    }
  }

  const upcoming = events.filter(e => e.status === 'upcoming')
  const past = events.filter(e => e.status === 'past')
  const withRecipe = events.filter(e => e.recipe_title)

  return (
    <main style={{ width: '100%', maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>

      <Link href="/" style={{ fontSize: '13px', color: '#1D9E75' }}>
        ← 給食だよりに戻る
      </Link>

      <div style={{ marginTop: '12px', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#085041' }}>
          🌾 食育のあしあと
        </h1>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
          ふたば保育園の食育活動
        </p>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        <button
          onClick={() => setTab('records')}
          style={{
            flex: 1, padding: '10px 4px', borderRadius: '8px', border: 'none',
            backgroundColor: tab === 'records' ? '#085041' : '#f0f0f0',
            color: tab === 'records' ? '#fff' : '#888',
            fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          記録・予告
        </button>
        <button
          onClick={() => setTab('recipes')}
          style={{
            flex: 1, padding: '10px 4px', borderRadius: '8px', border: 'none',
            backgroundColor: tab === 'recipes' ? '#085041' : '#f0f0f0',
            color: tab === 'recipes' ? '#fff' : '#888',
            fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          家でやる食育
        </button>
      </div>

      {/* 記録・予告タブ */}
      {tab === 'records' && (
        <>
          {upcoming.length > 0 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', margin: '16px 0 10px' }}>
                📅 次回の食育イベント
              </p>
              {upcoming.map(e => (
                <div key={e.id} style={{
                  backgroundColor: '#FFF8F0', border: '1px solid #FAC775',
                  borderRadius: '12px', padding: '14px', marginBottom: '8px',
                }}>
                  <span style={{
                    display: 'inline-block', fontSize: '10px', fontWeight: 'bold',
                    backgroundColor: '#BA7517', color: '#fff', padding: '2px 8px',
                    borderRadius: '10px', marginBottom: '6px',
                  }}>予告</span>
                  <p style={{ fontSize: '11px', color: '#BA7517', marginBottom: '4px' }}>
                    {new Date(e.event_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{e.title}</p>
                  {e.description && (
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '6px', lineHeight: '1.6' }}>{e.description}</p>
                  )}
                </div>
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', margin: '16px 0 10px' }}>
                📷 これまでの食育のあしあと
              </p>
              {past.map(e => (
                <div key={e.id} style={{
                  border: '1px solid #e0e0e0', borderRadius: '12px',
                  marginBottom: '10px', overflow: 'hidden', backgroundColor: '#fff',
                }}>
                  {e.photo_url ? (
                    <img src={e.photo_url} alt={e.title} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '90px', backgroundColor: '#f0f7f4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#9FE1CB', fontSize: '12px',
                    }}>🌾 写真準備中</div>
                  )}
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                      {new Date(e.event_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '6px' }}>{e.title}</p>
                    {e.description && (
                      <p style={{ fontSize: '12px', color: '#666', lineHeight: '1.6' }}>{e.description}</p>
                    )}

                    {/* いいねボタン */}
                    <button
                      onClick={() => toggleLike(e.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        marginTop: '8px', background: 'none', border: 'none',
                        cursor: 'pointer', padding: '4px 0',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>{myLikes.has(e.id) ? '❤️' : '🤍'}</span>
                      <span style={{ fontSize: '12px', color: myLikes.has(e.id) ? '#E24B4A' : '#999' }}>
                        {likedEvents[e.id] || 0}
                      </span>
                    </button>

                    {e.recipe_title && (
                      <button
                        onClick={() => { setTab('recipes'); setOpenRecipeId(e.id) }}
                        style={{
                          marginTop: '8px', fontSize: '12px', color: '#1D9E75',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          display: 'block',
                        }}
                      >
                        🍳 家でも作れるレシピを見る →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {events.length === 0 && (
            <p style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '30px 0' }}>
              まだ食育の記録がありません
            </p>
          )}
        </>
      )}

      {/* 家でやる食育タブ */}
      {tab === 'recipes' && (
        <>
          {withRecipe.length === 0 && (
            <p style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '30px 0' }}>
              まだレシピの登録がありません
            </p>
          )}
          {withRecipe.map(e => (
            <div key={e.id} style={{
              border: '1px solid #e0e0e0', borderRadius: '12px',
              backgroundColor: '#f0f7f4', padding: '14px', marginBottom: '12px',
            }}>
              <p style={{ fontSize: '11px', color: '#085041', marginBottom: '4px' }}>{e.title}より</p>
              <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#085041', marginBottom: '10px' }}>
                🍳 {e.recipe_title}
              </p>

              {e.recipe_ingredients && e.recipe_ingredients.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', marginBottom: '4px' }}>材料</p>
                  <p style={{ fontSize: '12px', color: '#444', lineHeight: '1.8' }}>
                    {e.recipe_ingredients.join('　')}
                  </p>
                </div>
              )}

              {e.recipe_steps && (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '10px 12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', marginBottom: '4px' }}>作り方</p>
                  <p style={{ fontSize: '12px', color: '#444', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                    {e.recipe_steps}
                  </p>
                </div>
              )}
            </div>
          ))}
        </>
      )}

    </main>
  )
}