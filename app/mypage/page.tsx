/* app/mypage/page.tsx — 保護者のマイページ */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLoadEffect, fetchJson } from '@/lib/useLoadEffect'
import type { Menu, GuardianQuestion, QuestionsResponse } from '@/lib/apiTypes'

/** お気に入り1件（献立の一部の列と一緒に読む） */
type Favorite = {
  created_at: string | null
  menus: Pick<Menu, 'id' | 'served_date' | 'title' | 'photo_url'> | null
}
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useGuardian } from '@/lib/useGuardian'
import { formatDate, initialOf } from '@/lib/guardian'
import { THEMES, DEFAULT_THEME, applyTheme, saveThemeLocal, themeOfSettings, type ThemeKey } from '@/lib/theme'
import AllergenPicker from '@/components/AllergenPicker'
import { isAllergyPending, toAllergenMap } from '@/lib/allergens'

type Tab = 'child' | 'allergy' | 'favorites' | 'questions' | 'settings'

export default function MyPage() {
  const router = useRouter()
  const { loading, guardian, child, signedOut, reload } = useGuardian()
  const [tab, setTab] = useState<Tab>('child')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [saving, setSaving] = useState(false)

  const [allergens, setAllergens] = useState<Record<string, boolean>>({})
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [questions, setQuestions] = useState<GuardianQuestion[]>([])

  const notify = (text: string, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  useEffect(() => {
    if (signedOut) router.push('/login')
  }, [signedOut, router])

  /* 園児の情報が読み込まれたら（読み直されたら）、編集欄をその内容に合わせる */
  const [syncedChild, setSyncedChild] = useState(child)
  if (child !== syncedChild) {
    setSyncedChild(child)
    setAllergens(toAllergenMap(child?.allergens))
  }

  /* ---------------- お気に入り・送った質問（タブを開いたときに読む） ---------------- */

  const requestTab = useCallback(async () => {
    if (!guardian) return null

    if (tab === 'favorites') {
      const { data } = await supabase
        .from('favorites')
        .select('created_at, menus(id, served_date, title, photo_url)')
        .eq('guardian_id', guardian.id)
        .order('created_at', { ascending: false })
      return { kind: 'favorites' as const, list: data ?? [] }
    }

    /* 自分の質問と、それへの返信（replied_to で紐づくもの）だけを API から取る */
    if (tab === 'questions') {
      const r = await fetchJson<QuestionsResponse>('/api/questions')
      return { kind: 'questions' as const, list: r.ok ? r.json.questions : [] }
    }

    return null
  }, [guardian, tab])

  const applyTab = (r: Awaited<ReturnType<typeof requestTab>>) => {
    if (r?.kind === 'favorites') setFavorites(r.list)
    if (r?.kind === 'questions') setQuestions(r.list)
  }
  useLoadEffect(requestTab, applyTab)
  /* お気に入りを外したあとに取り直す */
  const fetchFavorites = () => requestTab().then(applyTab)

  /* ---------------- 保存 ---------------- */

  const saveAllergens = async () => {
    if (!child) return
    setSaving(true)
    const res = await fetch('/api/guardian', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allergens }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { notify('保存できませんでした。' + json.error, true); return }
    notify('アレルギー情報を保存しました。')
    reload()
  }

  const changeTheme = async (key: ThemeKey) => {
    applyTheme(key)
    saveThemeLocal(key)
    if (!guardian) return
    await fetch('/api/guardian', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: key }),
    })
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

  const currentTheme = themeOfSettings(guardian.settings) ?? DEFAULT_THEME

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

            {isAllergyPending(child.allergens, child.allergens_confirmed) && (
              <p className="fa-toast" role="status" style={{ marginTop: 12, marginBottom: 0 }}>
                変更した内容を、いま園で確認しています。
                確認が済むまでは、変更前と変更後の両方に気をつけて給食を用意します。
              </p>
            )}

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
              {favorites.map((f) => (
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
                      onClick={() => { if (f.menus) removeFavorite(f.menus.id) }}
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
              {questions.map((q) => (
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
                    q.replies.map((r) => (
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