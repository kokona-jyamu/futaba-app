'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/* ------------------------------------------------------------------ */
/* 定数                                                                */
/* ------------------------------------------------------------------ */

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

const ALLERGENS = [
  { key: 'egg', label: '卵', emoji: '🥚' },
  { key: 'milk', label: '乳', emoji: '🥛' },
  { key: 'wheat', label: '小麦', emoji: '🌾' },
  { key: 'buckwheat', label: 'そば', emoji: '🍜' },
  { key: 'peanut', label: '落花生', emoji: '🥜' },
  { key: 'shrimp', label: 'えび', emoji: '🦐' },
  { key: 'crab', label: 'かに', emoji: '🦀' },
  { key: 'walnut', label: 'くるみ', emoji: '🌰' },
  { key: 'cashew', label: 'カシュー', emoji: '🌱' },
] as const

const NUTRIENTS = [
  { name: 'kcal', label: 'エネルギー', unit: 'kcal' },
  { name: 'carb', label: '炭水化物', unit: 'g' },
  { name: 'protein', label: 'タンパク質', unit: 'g' },
  { name: 'fat', label: '脂質', unit: 'g' },
  { name: 'salt', label: '食塩相当量', unit: 'g' },
  { name: 'calcium', label: 'カルシウム', unit: 'mg' },
] as const

type Allergens = Record<string, boolean>

const emptyAllergens = (): Allergens =>
  ALLERGENS.reduce((acc, a) => ({ ...acc, [a.key]: false }), {} as Allergens)

const emptyForm = () => ({
  served_date: '',
  title: '',
  ingredient: '',
  nutritionist_comment: '',
  why_eat_note: '',
  kcal: '',
  carb: '',
  protein: '',
  fat: '',
  salt: '',
  calcium: '',
  allergens: emptyAllergens(),
})

type MenuForm = ReturnType<typeof emptyForm>

const num = (v: unknown) =>
  v === '' || v === null || v === undefined ? null : Number.parseFloat(String(v))

const formatDate = (d?: string) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
    : ''

/* ------------------------------------------------------------------ */
/* アレルギー選択                                                      */
/* ------------------------------------------------------------------ */

function AllergenPicker({
  value,
  onToggle,
}: {
  value: Allergens
  onToggle: (key: string) => void
}) {
  return (
    <div className="ad-chips">
      {ALLERGENS.map((a) => {
        const on = !!value?.[a.key]
        return (
          <button
            type="button"
            key={a.key}
            onClick={() => onToggle(a.key)}
            aria-pressed={on}
            className={`ad-chip${on ? ' is-on' : ''}`}
          >
            <span className="ad-chip-emoji">{a.emoji}</span>
            <span className="ad-chip-label">{a.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 本体                                                                */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'post' | 'edit' | 'messages'>('post')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const [form, setForm] = useState<MenuForm>(emptyForm())
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [allMenus, setAllMenus] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)

  const [messages, setMessages] = useState<any[]>([])
  const [replyBody, setReplyBody] = useState<{ [key: string]: string }>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)

  /* ---------------- データ取得 ---------------- */

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, menus(title, served_date)')
      .eq('is_nutritionist', false)
      .order('created_at', { ascending: false })
    if (data) setMessages(data)
  }, [])

  const fetchMenus = useCallback(async () => {
    const { data } = await supabase
      .from('menus')
      .select('*')
      .eq('school_id', SCHOOL_ID)
      .order('served_date', { ascending: false })
    if (data) setAllMenus(data)
  }, [])

  useEffect(() => {
    fetchMessages()
    fetchMenus()
  }, [fetchMessages, fetchMenus])

  const notify = (text: string, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  /* ---------------- 投稿タブ ---------------- */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value })

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()
    const fileName = `${SCHOOL_ID}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-photos').upload(fileName, file)
    if (error) {
      notify('写真をアップロードできませんでした。' + error.message, true)
      return null
    }
    const { data } = supabase.storage.from('menu-photos').getPublicUrl(fileName)
    return data.publicUrl
  }

  const toggleAllergen = (key: string) =>
    setForm((f) => ({ ...f, allergens: { ...f.allergens, [key]: !f.allergens[key] } }))

  const handleSubmit = async () => {
    if (!form.served_date || !form.title) {
      notify('日付と献立名を入力してください。', true)
      return
    }

    setLoading(true)
    setMessage('')

    let photoUrl: string | null = null
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile)
      if (!photoUrl) {
        setLoading(false)
        return
      }
    }

    const { error } = await supabase.from('menus').insert({
      school_id: SCHOOL_ID,
      served_date: form.served_date,
      title: form.title,
      ingredient: form.ingredient || null,
      nutritionist_comment: form.nutritionist_comment,
      why_eat_note: form.why_eat_note,
      kcal: num(form.kcal),
      carb: num(form.carb),
      protein: num(form.protein),
      fat: num(form.fat),
      salt: num(form.salt),
      calcium: num(form.calcium),
      allergens: form.allergens,
      photo_url: photoUrl,
    })

    setLoading(false)

    if (error) {
      notify('保存できませんでした。' + error.message, true)
      return
    }

    notify('献立を公開しました。')
    setForm(emptyForm())
    setPhotoFile(null)
    setPhotoPreview(null)
    fetchMenus()
  }

  /* ---------------- 編集タブ ---------------- */

  const startEdit = (menu: any) => {
    setEditingId(menu.id)
    setEditForm({
      ...menu,
      ingredient: menu.ingredient ?? '',
      allergens: { ...emptyAllergens(), ...(menu.allergens || {}) },
    })
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
  }

  const toggleEditAllergen = (key: string) =>
    setEditForm((f: any) => ({
      ...f,
      allergens: { ...f.allergens, [key]: !f.allergens?.[key] },
    }))

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
  }

  const saveEdit = async () => {
    setLoading(true)

    let photoUrl = editForm.photo_url ?? null
    if (editPhotoFile) {
      const uploaded = await uploadPhoto(editPhotoFile)
      if (!uploaded) {
        setLoading(false)
        return
      }
      photoUrl = uploaded
    }

    const patch = {
      served_date: editForm.served_date,
      title: editForm.title,
      ingredient: editForm.ingredient || null,
      nutritionist_comment: editForm.nutritionist_comment,
      why_eat_note: editForm.why_eat_note,
      kcal: num(editForm.kcal),
      carb: num(editForm.carb),
      protein: num(editForm.protein),
      fat: num(editForm.fat),
      salt: num(editForm.salt),
      calcium: num(editForm.calcium),
      allergens: editForm.allergens,
      photo_url: photoUrl,
    }

    const { error } = await supabase.from('menus').update(patch).eq('id', editingId)
    setLoading(false)

    if (error) {
      notify('保存できませんでした。' + error.message, true)
      return
    }

    setAllMenus((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...patch } : m)))
    notify('献立を更新しました。')
    cancelEdit()
  }

  const deleteMenu = async (id: string) => {
    if (!confirm('この献立を削除します。元に戻せません。')) return
    const { error } = await supabase.from('menus').delete().eq('id', id)
    if (error) {
      notify('削除できませんでした。' + error.message, true)
      return
    }
    setAllMenus((prev) => prev.filter((m) => m.id !== id))
    notify('献立を削除しました。')
  }

  /* ---------------- 返信タブ ---------------- */

  const handleReply = async (menuId: string, messageId: string) => {
    const body = replyBody[messageId]
    if (!body?.trim()) return

    setReplyingId(messageId)
    const { error } = await supabase.from('messages').insert({
      menu_id: menuId,
      body: body.trim(),
      sender_name: '栄養士',
      is_nutritionist: true,
      is_public: true,
    })
    setReplyingId(null)

    if (error) {
      notify('返信を送れませんでした。' + error.message, true)
      return
    }

    setReplyBody({ ...replyBody, [messageId]: '' })
    notify('返信を送りました。')
    fetchMessages()
  }

  /* ---------------- 描画 ---------------- */

  return (
    <>
      <style>{CSS}</style>

      <div className="ad-page">
        <header className="ad-head">
          <div>
            <p className="ad-eyebrow">栄養士専用</p>
            <h1 className="ad-title">給食管理</h1>
          </div>
          <nav className="ad-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'post'}
              className={`ad-tab${activeTab === 'post' ? ' is-on' : ''}`}
              onClick={() => setActiveTab('post')}
            >
              <span className="ad-tab-icon">📝</span>献立を投稿
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'edit'}
              className={`ad-tab${activeTab === 'edit' ? ' is-on' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              <span className="ad-tab-icon">✏️</span>献立を編集
              {allMenus.length > 0 && <span className="ad-badge">{allMenus.length}</span>}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'messages'}
              className={`ad-tab${activeTab === 'messages' ? ' is-on' : ''}`}
              onClick={() => setActiveTab('messages')}
            >
              <span className="ad-tab-icon">💬</span>質問に返信
              {messages.length > 0 && <span className="ad-badge">{messages.length}</span>}
            </button>
          </nav>
        </header>

        {message && (
          <p className={`ad-toast${isError ? ' is-error' : ''}`} role="status">
            {message}
          </p>
        )}

        {/* ---------- 投稿 ---------- */}
        {activeTab === 'post' && (
          <div className="ad-cols">
            <section className="ad-card">
              <h2 className="ad-cardtitle">きょうの献立</h2>

              <label className="ad-label" htmlFor="served_date">
                日付 <span className="ad-req">必須</span>
              </label>
              <input
                id="served_date"
                type="date"
                name="served_date"
                value={form.served_date}
                onChange={handleChange}
                className="ad-input"
              />

              <label className="ad-label" htmlFor="title">
                献立名 <span className="ad-req">必須</span>
              </label>
              <input
                id="title"
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="例：さばの味噌煮定食"
                className="ad-input"
              />

              <label className="ad-label" htmlFor="ingredient">
                主な食材
              </label>
              <textarea
                id="ingredient"
                name="ingredient"
                value={form.ingredient}
                onChange={handleChange}
                placeholder="例：さば、みそ、しょうが、にんじん、だいこん"
                rows={2}
                className="ad-input ad-textarea"
              />

              <label className="ad-label">写真</label>
              <div
                className="ad-drop"
                onClick={() => document.getElementById('photo-input')?.click()}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="選んだ写真" className="ad-preview" />
                ) : (
                  <div className="ad-drop-empty">
                    <span className="ad-drop-icon">📷</span>
                    <span className="ad-drop-text">タップして写真を選ぶ</span>
                    <span className="ad-drop-sub">JPG・PNG</span>
                  </div>
                )}
              </div>
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                hidden
              />
            </section>

            <section className="ad-card">
              <div className="ad-panel ad-panel--green">
                <h2 className="ad-paneltitle">栄養価</h2>
                <div className="ad-nutri">
                  {NUTRIENTS.map((f) => (
                    <div key={f.name}>
                      <label className="ad-mini" htmlFor={`post-${f.name}`}>
                        {f.label}
                        <span className="ad-unit">{f.unit}</span>
                      </label>
                      <input
                        id={`post-${f.name}`}
                        type="number"
                        inputMode="decimal"
                        name={f.name}
                        value={form[f.name] as string}
                        onChange={handleChange}
                        placeholder="0"
                        className="ad-input ad-input--sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="ad-panel ad-panel--apricot">
                <h2 className="ad-paneltitle ad-paneltitle--apricot">
                  アレルギー<span className="ad-hint">タップで切り替え</span>
                </h2>
                <AllergenPicker value={form.allergens} onToggle={toggleAllergen} />
              </div>

              <label className="ad-label" htmlFor="nutritionist_comment">
                栄養士コメント
              </label>
              <textarea
                id="nutritionist_comment"
                name="nutritionist_comment"
                value={form.nutritionist_comment}
                onChange={handleChange}
                placeholder="今日の給食のポイントを書いてください"
                rows={3}
                className="ad-input ad-textarea"
              />

              <label className="ad-label" htmlFor="why_eat_note">
                今日の食べっぷり
              </label>
              <textarea
                id="why_eat_note"
                name="why_eat_note"
                value={form.why_eat_note}
                onChange={handleChange}
                placeholder="子どもたちの様子を書いてください"
                rows={3}
                className="ad-input ad-textarea"
              />

              <div className="ad-actions">
                <button onClick={handleSubmit} disabled={loading} className="ad-btn ad-btn--primary">
                  {loading ? '保存中…' : '献立を公開する'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ---------- 編集 ---------- */}
        {activeTab === 'edit' && (
          <section>
            <h2 className="ad-sectiontitle">投稿済みの献立</h2>

            {allMenus.length === 0 && (
              <p className="ad-empty">
                まだ献立がありません。「献立を投稿」から最初の1件を追加してください。
              </p>
            )}

            <div className="ad-grid">
              {allMenus.map((menu) => (
                <article
                  key={menu.id}
                  className={`ad-card ad-menu${editingId === menu.id ? ' is-editing' : ''}`}
                >
                  {editingId === menu.id ? (
                    <>
                      <div className="ad-cols">
                        <div>
                          <label className="ad-label">日付</label>
                          <input
                            type="date"
                            value={editForm.served_date || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, served_date: e.target.value })
                            }
                            className="ad-input"
                          />

                          <label className="ad-label">献立名</label>
                          <input
                            type="text"
                            value={editForm.title || ''}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="ad-input"
                          />

                          <label className="ad-label">主な食材</label>
                          <textarea
                            value={editForm.ingredient || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, ingredient: e.target.value })
                            }
                            rows={2}
                            className="ad-input ad-textarea"
                          />

                          <label className="ad-label">写真</label>
                          <div
                            className="ad-drop"
                            onClick={() =>
                              document.getElementById(`edit-photo-${menu.id}`)?.click()
                            }
                          >
                            {editPhotoPreview || editForm.photo_url ? (
                              <img
                                src={editPhotoPreview || editForm.photo_url}
                                alt="献立の写真"
                                className="ad-preview"
                              />
                            ) : (
                              <div className="ad-drop-empty">
                                <span className="ad-drop-icon">📷</span>
                                <span className="ad-drop-text">タップして写真を選ぶ</span>
                              </div>
                            )}
                          </div>
                          <input
                            id={`edit-photo-${menu.id}`}
                            type="file"
                            accept="image/*"
                            onChange={handleEditPhotoChange}
                            hidden
                          />
                        </div>

                        <div>
                          <div className="ad-panel ad-panel--green">
                            <h3 className="ad-paneltitle">栄養価</h3>
                            <div className="ad-nutri">
                              {NUTRIENTS.map((f) => (
                                <div key={f.name}>
                                  <label className="ad-mini">
                                    {f.label}
                                    <span className="ad-unit">{f.unit}</span>
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={editForm[f.name] ?? ''}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, [f.name]: e.target.value })
                                    }
                                    className="ad-input ad-input--sm"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="ad-panel ad-panel--apricot">
                            <h3 className="ad-paneltitle ad-paneltitle--apricot">アレルギー</h3>
                            <AllergenPicker
                              value={editForm.allergens || {}}
                              onToggle={toggleEditAllergen}
                            />
                          </div>

                          <label className="ad-label">栄養士コメント</label>
                          <textarea
                            value={editForm.nutritionist_comment || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, nutritionist_comment: e.target.value })
                            }
                            rows={2}
                            className="ad-input ad-textarea"
                          />

                          <label className="ad-label">今日の食べっぷり</label>
                          <textarea
                            value={editForm.why_eat_note || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, why_eat_note: e.target.value })
                            }
                            rows={2}
                            className="ad-input ad-textarea"
                          />
                        </div>
                      </div>

                      <div className="ad-btnrow">
                        <button
                          onClick={saveEdit}
                          disabled={loading}
                          className="ad-btn ad-btn--primary"
                        >
                          {loading ? '保存中…' : '変更を保存する'}
                        </button>
                        <button onClick={cancelEdit} className="ad-btn ad-btn--ghost">
                          やめる
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {menu.photo_url && (
                        <img src={menu.photo_url} alt="" className="ad-thumb" />
                      )}
                      <p className="ad-date">{formatDate(menu.served_date)}</p>
                      <p className="ad-menuname">{menu.title}</p>
                      <div className="ad-tagrow">
                        {ALLERGENS.filter((a) => menu.allergens?.[a.key]).map((a) => (
                          <span key={a.key} className="ad-tag">
                            {a.emoji} {a.label}
                          </span>
                        ))}
                      </div>
                      <div className="ad-btnrow">
                        <button onClick={() => startEdit(menu)} className="ad-btn ad-btn--sky">
                          編集する
                        </button>
                        <button onClick={() => deleteMenu(menu.id)} className="ad-btn ad-btn--rose">
                          削除する
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---------- 返信 ---------- */}
        {activeTab === 'messages' && (
          <section>
            <h2 className="ad-sectiontitle">保護者からの質問</h2>

            {messages.length === 0 && (
              <p className="ad-empty">まだ質問はありません。届くとここに並びます。</p>
            )}

            <div className="ad-grid ad-grid--2">
              {messages.map((msg) => (
                <article key={msg.id} className="ad-card">
                  <p className="ad-date">
                    {formatDate(msg.menus?.served_date)}　{msg.menus?.title}
                  </p>
                  <div className="ad-bubble">
                    <p className="ad-sender">👤 {msg.sender_name}</p>
                    <p className="ad-body">{msg.body}</p>
                  </div>
                  <div className="ad-replyrow">
                    <textarea
                      value={replyBody[msg.id] || ''}
                      onChange={(e) => setReplyBody({ ...replyBody, [msg.id]: e.target.value })}
                      placeholder="返信を入力…"
                      rows={2}
                      className="ad-input ad-textarea"
                    />
                    <button
                      onClick={() => handleReply(msg.menu_id, msg.id)}
                      disabled={!replyBody[msg.id]?.trim() || replyingId === msg.id}
                      className="ad-btn ad-btn--primary ad-btn--send"
                    >
                      {replyingId === msg.id ? '送信中…' : '返信する'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* スタイル（1ファイル完結・メディアクエリでPC/タブレット/スマホ可変） */
/* ------------------------------------------------------------------ */

const CSS = `
.ad-page {
  --bg: #F7F6F1;
  --card: #FFFFFF;
  --ink: #3C4A44;
  --muted: #909C96;
  --line: #E9E6DD;

  --matcha: #6FA98D;
  --matcha-deep: #35695A;
  --matcha-soft: #E9F3ED;

  --apricot: #E0A15C;
  --apricot-ink: #96652A;
  --apricot-soft: #FDF2E4;

  --sky-soft: #EAF2FA;
  --sky-ink: #47719D;

  --rose-soft: #FBECEA;
  --rose-ink: #A96460;

  --r: 16px;
  --shadow: 0 1px 2px rgba(60,74,68,.04), 0 8px 24px rgba(60,74,68,.05);

  box-sizing: border-box;
  max-width: 560px;
  margin: 0 auto;
  padding: 20px 16px 64px;
  background: var(--bg);
  min-height: 100vh;
  color: var(--ink);
  font-family: "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Hiragino Sans",
    "Noto Sans JP", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.ad-page *, .ad-page *::before, .ad-page *::after { box-sizing: border-box; }
.ad-page p, .ad-page h1, .ad-page h2, .ad-page h3 { margin: 0; }

/* ---------- ヘッダー / タブ ---------- */
.ad-head { margin-bottom: 20px; }
.ad-eyebrow {
  font-size: 11px; letter-spacing: .12em; color: var(--matcha);
  font-weight: 700; margin-bottom: 2px;
}
.ad-title { font-size: 22px; font-weight: 700; color: var(--matcha-deep); letter-spacing: .02em; }

.ad-tabs { display: flex; gap: 6px; margin-top: 16px; }
.ad-tab {
  flex: 1; min-width: 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 11px 6px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--card); color: var(--muted);
  font: inherit; font-size: 13px; font-weight: 700; white-space: nowrap;
  cursor: pointer; transition: background .18s, color .18s, border-color .18s;
}
.ad-tab:hover { border-color: var(--matcha); color: var(--matcha-deep); }
.ad-tab.is-on {
  background: var(--matcha-soft); border-color: var(--matcha);
  color: var(--matcha-deep); box-shadow: inset 0 0 0 1px var(--matcha);
}
.ad-tab-icon { font-size: 14px; }
.ad-badge {
  display: inline-block; min-width: 18px; padding: 1px 5px;
  border-radius: 999px; background: var(--apricot-soft); color: var(--apricot-ink);
  font-size: 10px; line-height: 16px; font-weight: 700;
}

/* ---------- 通知 ---------- */
.ad-toast {
  margin-bottom: 16px; padding: 11px 14px; border-radius: 12px;
  background: var(--matcha-soft); color: var(--matcha-deep);
  font-size: 13px; font-weight: 700;
}
.ad-toast.is-error { background: var(--rose-soft); color: var(--rose-ink); }

/* ---------- カード / パネル ---------- */
.ad-card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--r); padding: 18px; box-shadow: var(--shadow);
}
.ad-cardtitle, .ad-sectiontitle {
  font-size: 15px; font-weight: 700; color: var(--matcha-deep);
}
.ad-sectiontitle { margin-bottom: 14px; }
.ad-panel { margin-top: 16px; padding: 14px; border-radius: 14px; }
.ad-panel:first-child { margin-top: 0; }
.ad-panel--green { background: var(--matcha-soft); }
.ad-panel--apricot { background: var(--apricot-soft); }
.ad-paneltitle {
  font-size: 12px; font-weight: 700; color: var(--matcha-deep); margin-bottom: 10px;
}
.ad-paneltitle--apricot { color: var(--apricot-ink); }
.ad-hint { margin-left: 8px; font-size: 10px; font-weight: 500; opacity: .75; }

/* ---------- フォーム ---------- */
.ad-label {
  display: block; margin: 16px 0 5px;
  font-size: 12px; font-weight: 700; color: #6B7772;
}
.ad-cardtitle + .ad-label { margin-top: 14px; }
.ad-req {
  margin-left: 6px; padding: 1px 6px; border-radius: 999px;
  background: var(--apricot-soft); color: var(--apricot-ink);
  font-size: 10px; font-weight: 700;
}
.ad-input {
  display: block; width: 100%; max-width: 100%;
  padding: 11px 13px; border: 1px solid var(--line); border-radius: 11px;
  background: #FDFDFB; color: var(--ink);
  font: inherit; font-size: 14px; outline: none;
  -webkit-appearance: none; appearance: none;
  transition: border-color .15s, box-shadow .15s;
}
.ad-input::placeholder { color: #BAC3BE; }
.ad-input:focus {
  border-color: var(--matcha); box-shadow: 0 0 0 3px rgba(111,169,141,.16);
  background: #fff;
}
.ad-input--sm { padding: 8px 10px; font-size: 13px; }
.ad-textarea { resize: vertical; line-height: 1.65; }
.ad-mini {
  display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px;
  font-size: 11px; font-weight: 700; color: #6B7772;
}
.ad-unit { font-size: 10px; font-weight: 500; color: var(--muted); }
.ad-nutri { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }

/* 写真 */
.ad-drop {
  margin-top: 5px; padding: 14px; border: 2px dashed #DCE5E0; border-radius: 14px;
  background: #FBFCFA; text-align: center; cursor: pointer; transition: border-color .15s;
}
.ad-drop:hover { border-color: var(--matcha); }
.ad-drop-empty { display: flex; flex-direction: column; gap: 3px; padding: 14px 0; }
.ad-drop-icon { font-size: 26px; }
.ad-drop-text { font-size: 13px; color: #7C8A84; font-weight: 700; }
.ad-drop-sub { font-size: 11px; color: #B4BEB9; }
.ad-preview {
  display: block; width: 100%; max-height: 260px;
  border-radius: 10px; object-fit: cover;
}

/* アレルギー */
.ad-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ad-chip {
  width: 56px; height: 56px; padding: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  border: 2px solid #EBE7DE; border-radius: 50%;
  background: #F6F5F1; color: #A9B2AD; font: inherit;
  cursor: pointer; transition: transform .15s, background .15s, border-color .15s, color .15s;
}
.ad-chip:hover { transform: translateY(-2px); }
.ad-chip.is-on {
  background: #fff; border-color: var(--apricot); color: var(--apricot-ink);
  box-shadow: 0 2px 8px rgba(224,161,92,.22);
}
.ad-chip-emoji { font-size: 19px; filter: grayscale(.7); opacity: .55; transition: filter .15s, opacity .15s; }
.ad-chip.is-on .ad-chip-emoji { filter: none; opacity: 1; }
.ad-chip-label { font-size: 9px; font-weight: 700; }

/* ---------- ボタン ---------- */
.ad-actions { margin-top: 22px; }
.ad-btnrow { display: flex; gap: 8px; margin-top: 14px; }
.ad-btn {
  flex: 1; padding: 13px 18px; border: none; border-radius: 12px;
  font: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
  transition: filter .15s, background .15s;
}
.ad-btn:hover:not(:disabled) { filter: brightness(.96); }
.ad-btn:disabled { opacity: .5; cursor: not-allowed; }
.ad-btn--primary { width: 100%; background: var(--matcha-deep); color: #fff; }
.ad-btn--ghost { background: #F2F1EC; color: #86918B; }
.ad-btn--sky { background: var(--sky-soft); color: var(--sky-ink); padding: 10px; font-size: 13px; }
.ad-btn--rose { background: var(--rose-soft); color: var(--rose-ink); padding: 10px; font-size: 13px; }
.ad-btn--send { flex: 0 0 auto; width: auto; white-space: nowrap; }

/* ---------- 一覧 ---------- */
.ad-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
.ad-menu.is-editing { grid-column: 1 / -1; }
.ad-empty {
  padding: 32px 16px; border: 1px dashed var(--line); border-radius: var(--r);
  background: var(--card); text-align: center; font-size: 13px; color: var(--muted);
}
.ad-thumb {
  width: 100%; height: 148px; margin-bottom: 12px;
  border-radius: 12px; object-fit: cover;
}
.ad-date { font-size: 11px; font-weight: 700; color: var(--matcha); }
.ad-menuname { margin-top: 4px; font-size: 15px; font-weight: 700; color: var(--ink); }
.ad-tagrow { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.ad-tag {
  padding: 3px 9px; border-radius: 999px;
  background: var(--apricot-soft); color: var(--apricot-ink);
  font-size: 10px; font-weight: 700;
}

/* ---------- 質問 ---------- */
.ad-bubble { margin-top: 10px; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: var(--sky-soft); }
.ad-sender { font-size: 11px; font-weight: 700; color: var(--sky-ink); opacity: .8; }
.ad-body { margin-top: 5px; font-size: 13.5px; line-height: 1.7; color: #33587E; }
.ad-replyrow { display: flex; gap: 8px; align-items: flex-end; margin-top: 12px; }
.ad-replyrow .ad-input { flex: 1; }

/* ---------- レイアウト（同一画面をCSSで可変） ---------- */
.ad-cols { display: grid; grid-template-columns: 1fr; gap: 16px; }

/* タブレット（縦持ち〜） */
@media (min-width: 700px) {
  .ad-page { max-width: 880px; padding: 32px 28px 80px; }
  .ad-title { font-size: 26px; }
  .ad-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
  .ad-tabs { margin-top: 0; flex: 0 1 auto; }
  .ad-tab { flex: 0 0 auto; padding: 11px 18px; font-size: 13.5px; }
  .ad-card { padding: 22px; }
  .ad-nutri { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .ad-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .ad-btn--primary { width: auto; min-width: 220px; }
  .ad-actions { display: flex; justify-content: flex-end; }
  .ad-thumb { height: 168px; }
}

/* PC */
@media (min-width: 1080px) {
  .ad-page { max-width: 1180px; padding: 40px 40px 96px; }
  .ad-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 24px; align-items: start; }
  .ad-grid { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; }
  .ad-grid--2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .ad-nutri { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
  .ad-chip { width: 60px; height: 60px; }
  .ad-chip-emoji { font-size: 21px; }
  .ad-menu.is-editing .ad-cols { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
}

/* ---------- アクセシビリティ ---------- */
.ad-page :focus-visible { outline: 2px solid var(--matcha); outline-offset: 2px; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) {
  .ad-page * { transition: none !important; animation: none !important; }
}
`