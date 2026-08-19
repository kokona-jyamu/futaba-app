/* app/mypage/page.tsx — 保護者のマイページ */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useGuardian } from '@/lib/useGuardian'
import { ALLERGENS, formatDate, initialOf } from '@/lib/guardian'
import { THEMES, applyTheme, saveThemeLocal, type ThemeKey } from '@/lib/theme'
import AllergenPicker from '@/components/AllergenPicker'

type Tab = 'child' | 'allergy' | 'favorites' | 'questions' | 'settings'

export default function MyPage() {
  const router = useRouter()
  const { loading, guardian, child, signedOut, reload } = useGuardian()
  const [tab, setTab] = useState<Tab>('child')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [saving, setSaving] = useState(false)

  const [allergens, setAllergens] = useState<Record<string, boolean>>({})
  const [favorites, setFavorites] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])

  const notify = (text: string, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  useEffect(() => {
    if (signedOut) router.push('/login')
  }, [signedOut, router])

  useEffect(() => {
    if (child?.allergens) setAllergens({ ...child.allergens })
  }, [child])

  /* ---------------- お気に入り ---------------- */

  const fetchFavorites = useCallback(async () => {
    if (!guardian) return
    const { data } = await supabase
      .from('favorites')
      .select('created_at, menus(id, served_date, title, photo_url)')
      .eq('guardian_id', guardian.id)
      .order('created_at', { ascending: false })
    setFavorites(data ?? [])
  }, [guardian])

  /* ---------------- 送った質問 ---------------- */

  const fetchQuestions = useCallback(async () => {
    if (!guardian) return

    /* 自分が送った質問 */
    const { data: mine } = await supabase
      .from('messages')
      .select('id, body, created_at, menu_id, menus(title, served_date)')
      .eq('guardian_id', guardian.id)
      .eq('is_nutritionist', false)
      .order('created_at', { ascending: false })

    if (!mine || mine.length === 0) { setQuestions([]); return }

    /* 同じ献立への栄養士の返信を拾う */
    const menuIds = [...new Set(mine.map((m) => m.menu_id))]
    const { data: replies } = await supabase
      .from('messages')
      .select('id, body, created_at, menu_id')
      .in('menu_id', menuIds)
      .eq('is_nutritionist', true)
      .order('created_at', { ascending: true })

    setQuestions(
      mine.map((q) => ({
        ...q,
        replies: (replies ?? []).filter(
          (r) => r.menu_id === q.menu_id && r.created_at > q.created_at
        ),
      }))
    )
  }, [guardian])

  useEffect(() => {
    if (tab === 'favorites') fetchFavorites()
    if (tab === 'questions') fetchQuestions()
  }, [tab, fetchFavorites, fetchQuestions])

  /* ---------------- 保存 ---------------- */

  const saveAllergens = async () => {
    if (!child) return
    setSaving(true)
    const { error } = await supabase
      .from('children')
      .update({ allergens })
      .eq('id', child.id)
    setSaving(false)

    if (error) { notify('保存できませんでした。' + error.message, true); return }
    notify('アレルギー情報を保存しました。')
    reload()
  }

  const changeTheme = async (key: ThemeKey) => {
    applyTheme(key)
    saveThemeLocal(key)
    if (!guardian) return
    await supabase
      .from('guardians')
      .update({ settings: { ...(guardian.settings ?? {}), theme: key } })
      .eq('id', guardian.id)
    reload()
  }

  const removeFavorite = async (menuId: string) => {
    if (!guardian) return
    await supabase
      .from('favorites')
      .delete()
      .eq('guardian_id', guardian.id)
      .eq('menu_id', menuId)
    fetchFavorites()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  /* ---------------- 描画 ---------------- */

  if (loading) {
    return (
      <main className="fa-page">
        <p className="fa-empty">読み込んでいます…</p>
      </main>
    )
  }

if (!guardian || !child) {
    return (
      <main className="fa-page">
        <section className="fa-card" style={{ maxWidth: 480, marginTop: '10vh' }}>
          <h1 className="fa-cardtitle">別のアカウントでログイン中です</h1>
          <p className="fa-note" style={{ marginTop: 10 }}>
            このページは保護者の方向けです。栄養士・園担当者の方は管理画面をご利用ください。
            保護者としてご覧になる場合は、いったんログアウトしてください。
          </p>
          <div className="fa-btnrow">
            <Link href="/admin" className="fa-link" style={{ flex: 1 }}>
              <button className="fa-btn fa-btn--sky" style={{ width: '100%' }}>
                管理画面へ
              </button>
            </Link>
            <button onClick={handleLogout} className="fa-btn fa-btn--ghost">
              ログアウト
            </button>
          </div>
        </section>
      </main>
    )
  }

  const currentTheme = (guardian.settings as any)?.theme ?? 'matcha'

  return (
    <main className="fa-page">
      <Link href="/" className="fa-back">← 給食だよりに戻る</Link>

      <header className="fa-myhead">
        <span className="fa-avatar fa-avatar--lg">{initialOf(child.name)}</span>
        <div style={{ minWidth: 0 }}>
          <p className="fa-date">
            {child.class_name ?? 'クラス未設定'}　No.{child.login_no}
          </p>
          <h1 className="fa-title" style={{ fontSize: 20 }}>{child.name} さん</h1>
        </div>
      </header>

      <nav className="fa-tabs fa-tabs--5" role="tablist">
        {([
          ['child', '👶', '園児'],
          ['allergy', '⚠️', 'アレルギー'],
          ['favorites', '⭐', 'お気に入り'],
          ['questions', '💬', '質問'],
          ['settings', '⚙️', '設定'],
        ] as const).map(([key, icon, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`fa-tab${tab === key ? ' is-on' : ''}`}
            onClick={() => setTab(key)}
          >
            <span className="fa-tab-icon">{icon}</span>{label}
          </button>
        ))}
      </nav>

      {message && (
        <p className={`fa-toast${isError ? ' is-error' : ''}`} role="status">{message}</p>
      )}

      <div className="fa-panel-area">

        {/* ---------- 園児情報 ---------- */}
        {tab === 'child' && (
          <section className="fa-card" style={{ maxWidth: 520 }}>
            <h2 className="fa-cardtitle">お子さまの情報</h2>
            <dl className="fa-deflist">
              <dt>お名前</dt><dd>{child.name}</dd>
              <dt>クラス</dt><dd>{child.class_name ?? '未設定'}</dd>
              <dt>出席番号</dt><dd>{child.login_no}</dd>
            </dl>
            <p className="fa-note">
              内容に誤りがある場合は、担任または園にお知らせください。
              こちらの画面からは変更できません。
            </p>
          </section>
        )}

        {/* ---------- アレルギー ---------- */}
        {tab === 'allergy' && (
          <section className="fa-card" style={{ maxWidth: 620 }}>
            <h2 className="fa-cardtitle">うちの子のアレルギー</h2>
            <p className="fa-note" style={{ marginTop: 8 }}>
              登録すると、該当する食材を含む献立に印がつきます。
              この情報はご家庭と園だけが見られます。
            </p>

            <div className="fa-tint fa-tint--apricot">
              <h3 className="fa-tinttitle fa-tinttitle--apricot">
                当てはまるものをえらぶ<span className="fa-hint">タップで切り替え</span>
              </h3>
              <AllergenPicker
                value={allergens}
                onToggle={(key) =>
                  setAllergens((a) => ({ ...a, [key]: !a[key] }))
                }
              />
            </div>

            <div className="fa-actions" style={{ display: 'block' }}>
              <button
                onClick={saveAllergens}
                disabled={saving}
                className="fa-btn fa-btn--primary"
                style={{ width: '100%' }}
              >
                {saving ? '保存中…' : '保存する'}
              </button>
            </div>

            <p className="fa-note" style={{ marginTop: 14 }}>
              重いアレルギーがある場合は、この登録だけに頼らず、
              必ず園にも直接お伝えください。
            </p>
          </section>
        )}

        {/* ---------- お気に入り ---------- */}
        {tab === 'favorites' && (
          <>
            {favorites.length === 0 && (
              <p className="fa-empty">
                まだお気に入りがありません。献立の詳細から⭐を押すと、ここに集まります。
              </p>
            )}
            <div className="fa-grid">
              {favorites.map((f: any) => (
                <article key={f.menus?.id} className="fa-card">
                  {f.menus?.photo_url && (
                    <img src={f.menus.photo_url} alt="" className="fa-thumb" />
                  )}
                  <p className="fa-date">{formatDate(f.menus?.served_date)}</p>
                  <p className="fa-menuname">{f.menus?.title}</p>
                  <div className="fa-btnrow">
                    <Link href={`/menu/${f.menus?.id}`} className="fa-link" style={{ flex: 1 }}>
                      <button className="fa-btn fa-btn--sky" style={{ width: '100%' }}>
                        見る
                      </button>
                    </Link>
                    <button
                      onClick={() => removeFavorite(f.menus?.id)}
                      className="fa-btn fa-btn--ghost"
                    >
                      はずす
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* ---------- 送った質問 ---------- */}
        {tab === 'questions' && (
          <>
            {questions.length === 0 && (
              <p className="fa-empty">
                まだ質問を送っていません。献立の詳細から栄養士さんに聞けます。
              </p>
            )}
            <div className="fa-grid fa-grid--2">
              {questions.map((q: any) => (
                <article key={q.id} className="fa-card">
                  <p className="fa-date">
                    {formatDate(q.menus?.served_date)}　{q.menus?.title}
                  </p>

                  <div className="fa-bubble fa-bubble--mine">
                    <p className="fa-sender">わたしの質問</p>
                    <p className="fa-body">{q.body}</p>
                  </div>

                  {q.replies.length === 0 ? (
                    <p className="fa-note" style={{ marginTop: 10 }}>
                      栄養士さんからの返信を待っています。
                    </p>
                  ) : (
                    q.replies.map((r: any) => (
                      <div key={r.id} className="fa-bubble fa-bubble--reply">
                        <p className="fa-sender">🌿 栄養士より</p>
                        <p className="fa-body">{r.body}</p>
                      </div>
                    ))
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {/* ---------- 設定 ---------- */}
        {tab === 'settings' && (
          <section className="fa-card" style={{ maxWidth: 620 }}>
            <h2 className="fa-cardtitle">画面の色</h2>
            <p className="fa-note" style={{ marginTop: 8 }}>
              お好みの色を選べます。この端末とアカウントに保存されます。
            </p>

            <div className="fa-themes">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTheme(t.key)}
                  className={`fa-theme${currentTheme === t.key ? ' is-on' : ''}`}
                  aria-pressed={currentTheme === t.key}
                >
                  <span className="fa-theme-dot" style={{ background: t.swatch }} />
                  <span className="fa-theme-label">{t.label}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--fa-line)' }}>
              <h2 className="fa-cardtitle">アカウント</h2>
              <p className="fa-note" style={{ marginTop: 8, marginBottom: 14 }}>
                PINを忘れた場合は、園で再発行できます。担任にお声がけください。
              </p>
              <button onClick={handleLogout} className="fa-btn fa-btn--ghost">
                ログアウト
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}