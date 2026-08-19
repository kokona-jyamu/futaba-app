/* app/admin/page.tsx */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { NUTRIENTS, SCHOOL_ID, num, formatDate, parseIngredients, formatIngredients } from '@/lib/menu'
import { emptyAllergenState, usedAllergens } from '@/lib/allergens'
import AllergenPicker from '@/components/AllergenPicker'
import ChildrenPanel from '@/components/ChildrenPanel'

const emptyForm = () => ({
  served_date: '',
  title: '',
  ingredient: '',
  nutritionist_comment: '',
  why_eat_note: '',
  kcal: '', carb: '', protein: '', fat: '', salt: '', calcium: '',
  allergens: emptyAllergenState(),
  allergen_checked: false,
})

type MenuForm = ReturnType<typeof emptyForm>

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'post' | 'edit' | 'messages' | 'children'>('post')
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
  const [onlyUnchecked, setOnlyUnchecked] = useState(false)

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

  /* アレルギー未確認の献立 */
  const uncheckedMenus = allMenus.filter((m) => !m.allergen_checked)
  const shownMenus = onlyUnchecked ? uncheckedMenus : allMenus

  /* ---------------- 投稿 ---------------- */

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

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

  /* 食材を1つでも選んだ時点で「確認済み」になる */
  const toggleAllergen = (key: string) =>
    setForm((f) => ({
      ...f,
      allergens: { ...f.allergens, [key]: !f.allergens[key] },
      allergen_checked: true,
    }))

  /* どれも使っていないことを明示する */
  const declareNone = () =>
    setForm((f) => ({
      ...f,
      allergens: emptyAllergenState(),
      allergen_checked: true,
    }))

  const handleSubmit = async () => {
    if (!form.served_date || !form.title) {
      notify('日付と献立名を入力してください。', true)
      return
    }

    if (!form.allergen_checked) {
      notify('アレルギーを確認してください。使っている食材を選ぶか「該当なし」を押してください。', true)
      return
    }

    setLoading(true)
    setMessage('')

    let photoUrl: string | null = null
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile)
      if (!photoUrl) { setLoading(false); return }
    }

    const { error } = await supabase.from('menus').insert({
      school_id: SCHOOL_ID,
      served_date: form.served_date,
      title: form.title,
      ingredients: parseIngredients(form.ingredient),
      nutritionist_comment: form.nutritionist_comment,
      why_eat_note: form.why_eat_note,
      kcal: num(form.kcal), carb: num(form.carb), protein: num(form.protein),
      fat: num(form.fat), salt: num(form.salt), calcium: num(form.calcium),
      allergens: form.allergens,
      allergen_checked: true,
      photo_url: photoUrl,
    })

    setLoading(false)

    if (error) { notify('保存できませんでした。' + error.message, true); return }

    notify('献立を公開しました。')
    setForm(emptyForm())
    setPhotoFile(null)
    setPhotoPreview(null)
    fetchMenus()
  }

  /* ---------------- 編集 ---------------- */

  const startEdit = (menu: any) => {
    setEditingId(menu.id)
    setEditForm({
      ...menu,
      ingredient: formatIngredients(menu.ingredients),
      allergens: { ...emptyAllergenState(), ...(menu.allergens || {}) },
      allergen_checked: menu.allergen_checked ?? false,
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
      allergen_checked: true,
    }))

  const declareNoneEdit = () =>
    setEditForm((f: any) => ({
      ...f,
      allergens: emptyAllergenState(),
      allergen_checked: true,
    }))

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
  }

  const saveEdit = async () => {
    if (!editForm.allergen_checked) {
      notify('アレルギーを確認してください。使っている食材を選ぶか「該当なし」を押してください。', true)
      return
    }

    setLoading(true)

    let photoUrl = editForm.photo_url ?? null
    if (editPhotoFile) {
      const uploaded = await uploadPhoto(editPhotoFile)
      if (!uploaded) { setLoading(false); return }
      photoUrl = uploaded
    }

    const patch = {
      served_date: editForm.served_date,
      title: editForm.title,
      ingredients: parseIngredients(editForm.ingredient),
      nutritionist_comment: editForm.nutritionist_comment,
      why_eat_note: editForm.why_eat_note,
      kcal: num(editForm.kcal), carb: num(editForm.carb), protein: num(editForm.protein),
      fat: num(editForm.fat), salt: num(editForm.salt), calcium: num(editForm.calcium),
      allergens: editForm.allergens,
      allergen_checked: true,
      photo_url: photoUrl,
    }

    const { error } = await supabase.from('menus').update(patch).eq('id', editingId)
    setLoading(false)

    if (error) { notify('保存できませんでした。' + error.message, true); return }

    setAllMenus((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...patch } : m)))
    notify('献立を更新しました。')
    cancelEdit()
  }

  const deleteMenu = async (id: string) => {
    if (!confirm('この献立を削除します。元に戻せません。')) return
    const { error } = await supabase.from('menus').delete().eq('id', id)
    if (error) { notify('削除できませんでした。' + error.message, true); return }
    setAllMenus((prev) => prev.filter((m) => m.id !== id))
    notify('献立を削除しました。')
  }

  /* ---------------- 返信 ---------------- */

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

    if (error) { notify('返信を送れませんでした。' + error.message, true); return }

    setReplyBody({ ...replyBody, [messageId]: '' })
    notify('返信を送りました。')
    fetchMessages()
  }

  /* ---------------- 描画 ---------------- */

  return (
    <main className="fa-page">
      <header className="fa-head">
        <div>
          <p className="fa-eyebrow">栄養士専用</p>
          <h1 className="fa-title">給食管理</h1>
        </div>
        <nav className="fa-tabs" role="tablist">
          <button
            role="tab" aria-selected={activeTab === 'post'}
            className={`fa-tab${activeTab === 'post' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('post')}
          >
            <span className="fa-tab-icon">📝</span>献立を投稿
          </button>
          <button
            role="tab" aria-selected={activeTab === 'edit'}
            className={`fa-tab${activeTab === 'edit' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <span className="fa-tab-icon">✏️</span>献立を編集
            {allMenus.length > 0 && <span className="fa-badge">{allMenus.length}</span>}
          </button>
          <button
            role="tab" aria-selected={activeTab === 'messages'}
            className={`fa-tab${activeTab === 'messages' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <span className="fa-tab-icon">💬</span>質問に返信
            {messages.length > 0 && <span className="fa-badge">{messages.length}</span>}
          </button>
          <button
            role="tab" aria-selected={activeTab === 'children'}
            className={`fa-tab${activeTab === 'children' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('children')}
          >
            <span className="fa-tab-icon">👶</span>園児・PIN
          </button>
        </nav>
      </header>

      {message && (
        <p className={`fa-toast${isError ? ' is-error' : ''}`} role="status">{message}</p>
      )}

      {/* アレルギー未確認の献立があれば知らせる */}
      {uncheckedMenus.length > 0 && activeTab !== 'edit' && (
        <div className="fa-warnbox" style={{ marginBottom: 18 }}>
          <p className="fa-warntitle">
            アレルギー情報が未確認の献立が{uncheckedMenus.length}件あります
          </p>
          <p className="fa-warntext">
            保護者の絞り込み画面では「判断できません」と表示されます。
            「献立を編集」から順に登録してください。
          </p>
          <button
            onClick={() => { setActiveTab('edit'); setOnlyUnchecked(true) }}
            className="fa-btn fa-btn--sky"
            style={{ marginTop: 10, flex: '0 0 auto' }}
          >
            未確認の献立を見る
          </button>
        </div>
      )}

      <div className="fa-panel-area">

        {/* ---------- 投稿 ---------- */}
        {activeTab === 'post' && (
          <div className="fa-cols">
            <section className="fa-card">
              <h2 className="fa-cardtitle">本日の献立</h2>

              <label className="fa-label" htmlFor="served_date">
                日付 <span className="fa-req">必須</span>
              </label>
              <input id="served_date" type="date" name="served_date"
                value={form.served_date} onChange={handleChange} className="fa-input" />

              <label className="fa-label" htmlFor="title">
                献立名 <span className="fa-req">必須</span>
              </label>
              <input id="title" type="text" name="title" value={form.title}
                onChange={handleChange} placeholder="例：さばの味噌煮定食" className="fa-input" />

              <label className="fa-label" htmlFor="ingredient">主な食材</label>
              <textarea id="ingredient" name="ingredient" value={form.ingredient}
                onChange={handleChange} rows={2}
                placeholder="さば、みそ、しょうが、にんじん（読点か改行で区切ってください）"
                className="fa-input fa-textarea" />

              <label className="fa-label">写真</label>
              <div className="fa-drop" onClick={() => document.getElementById('photo-input')?.click()}>
                {photoPreview ? (
                  <img src={photoPreview} alt="選んだ写真" className="fa-preview" />
                ) : (
                  <div className="fa-drop-empty">
                    <span className="fa-drop-icon">📷</span>
                    <span className="fa-drop-text">タップして写真を選ぶ</span>
                    <span className="fa-drop-sub">JPG・PNG</span>
                  </div>
                )}
              </div>
              <input id="photo-input" type="file" accept="image/*" onChange={handlePhotoChange} hidden />
            </section>

            <section className="fa-card">
              <div className="fa-tint fa-tint--green">
                <h2 className="fa-tinttitle">栄養価</h2>
                <div className="fa-nutri">
                  {NUTRIENTS.map((f) => (
                    <div key={f.name}>
                      <label className="fa-mini" htmlFor={`post-${f.name}`}>
                        {f.label}<span className="fa-unit">{f.unit}</span>
                      </label>
                      <input id={`post-${f.name}`} type="number" inputMode="decimal"
                        name={f.name} value={form[f.name as keyof MenuForm] as string}
                        onChange={handleChange} placeholder="0"
                        className="fa-input fa-input--sm" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="fa-tint fa-tint--apricot">
                <h2 className="fa-tinttitle fa-tinttitle--apricot">
                  アレルギー<span className="fa-req">必須</span>
                </h2>
                <AllergenPicker
                  value={form.allergens}
                  onToggle={toggleAllergen}
                  onDeclareNone={declareNone}
                  checked={form.allergen_checked}
                />
              </div>

              <label className="fa-label" htmlFor="nutritionist_comment">栄養士コメント</label>
              <textarea id="nutritionist_comment" name="nutritionist_comment"
                value={form.nutritionist_comment} onChange={handleChange} rows={3}
                placeholder="今日の給食のポイントを書いてください"
                className="fa-input fa-textarea" />

              <label className="fa-label" htmlFor="why_eat_note">今日の食べっぷり</label>
              <textarea id="why_eat_note" name="why_eat_note"
                value={form.why_eat_note} onChange={handleChange} rows={3}
                placeholder="子どもたちの様子を書いてください"
                className="fa-input fa-textarea" />

              <div className="fa-actions">
                <button onClick={handleSubmit} disabled={loading} className="fa-btn fa-btn--primary">
                  {loading ? '保存中…' : '献立を公開する'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ---------- 編集 ---------- */}
        {activeTab === 'edit' && (
          <section>
            <div className="fa-listhead">
              <h2 className="fa-sectiontitle" style={{ marginBottom: 0 }}>
                投稿済みの献立
              </h2>
              {uncheckedMenus.length > 0 && (
                <label className="fa-filter">
                  <input
                    type="checkbox"
                    checked={onlyUnchecked}
                    onChange={(e) => setOnlyUnchecked(e.target.checked)}
                  />
                  アレルギー未確認だけ（{uncheckedMenus.length}件）
                </label>
              )}
            </div>

            {shownMenus.length === 0 && (
              <p className="fa-empty">
                {onlyUnchecked
                  ? 'アレルギー未確認の献立はありません。'
                  : 'まだ献立がありません。「献立を投稿」から最初の1件を追加してください。'}
              </p>
            )}

            <div className="fa-grid">
              {shownMenus.map((menu) => (
                <article key={menu.id}
                  className={`fa-card${editingId === menu.id ? ' fa-span-all' : ''}`}>
                  {editingId === menu.id ? (
                    <>
                      <div className="fa-cols">
                        <div>
                          <label className="fa-label">日付</label>
                          <input type="date" value={editForm.served_date || ''}
                            onChange={(e) => setEditForm({ ...editForm, served_date: e.target.value })}
                            className="fa-input" />

                          <label className="fa-label">献立名</label>
                          <input type="text" value={editForm.title || ''}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="fa-input" />

                          <label className="fa-label">主な食材</label>
                          <textarea value={editForm.ingredient || ''} rows={2}
                            onChange={(e) => setEditForm({ ...editForm, ingredient: e.target.value })}
                            className="fa-input fa-textarea" />

                          <label className="fa-label">写真</label>
                          <div className="fa-drop"
                            onClick={() => document.getElementById(`edit-photo-${menu.id}`)?.click()}>
                            {editPhotoPreview || editForm.photo_url ? (
                              <img src={editPhotoPreview || editForm.photo_url} alt="献立の写真"
                                className="fa-preview" />
                            ) : (
                              <div className="fa-drop-empty">
                                <span className="fa-drop-icon">📷</span>
                                <span className="fa-drop-text">タップして写真を選ぶ</span>
                              </div>
                            )}
                          </div>
                          <input id={`edit-photo-${menu.id}`} type="file" accept="image/*"
                            onChange={handleEditPhotoChange} hidden />
                        </div>

                        <div>
                          <div className="fa-tint fa-tint--green">
                            <h3 className="fa-tinttitle">栄養価</h3>
                            <div className="fa-nutri">
                              {NUTRIENTS.map((f) => (
                                <div key={f.name}>
                                  <label className="fa-mini">
                                    {f.label}<span className="fa-unit">{f.unit}</span>
                                  </label>
                                  <input type="number" inputMode="decimal"
                                    value={editForm[f.name] ?? ''}
                                    onChange={(e) => setEditForm({ ...editForm, [f.name]: e.target.value })}
                                    className="fa-input fa-input--sm" />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="fa-tint fa-tint--apricot">
                            <h3 className="fa-tinttitle fa-tinttitle--apricot">
                              アレルギー<span className="fa-req">必須</span>
                            </h3>
                            <AllergenPicker
                              value={editForm.allergens || {}}
                              onToggle={toggleEditAllergen}
                              onDeclareNone={declareNoneEdit}
                              checked={editForm.allergen_checked}
                            />
                          </div>

                          <label className="fa-label">栄養士コメント</label>
                          <textarea value={editForm.nutritionist_comment || ''} rows={2}
                            onChange={(e) => setEditForm({ ...editForm, nutritionist_comment: e.target.value })}
                            className="fa-input fa-textarea" />

                          <label className="fa-label">今日の食べっぷり</label>
                          <textarea value={editForm.why_eat_note || ''} rows={2}
                            onChange={(e) => setEditForm({ ...editForm, why_eat_note: e.target.value })}
                            className="fa-input fa-textarea" />
                        </div>
                      </div>

                      <div className="fa-btnrow">
                        <button onClick={saveEdit} disabled={loading} className="fa-btn fa-btn--primary">
                          {loading ? '保存中…' : '変更を保存する'}
                        </button>
                        <button onClick={cancelEdit} className="fa-btn fa-btn--ghost">やめる</button>
                      </div>
                    </>
                  ) : (
                    <>
                      {menu.photo_url && <img src={menu.photo_url} alt="" className="fa-thumb" />}
                      <p className="fa-date">{formatDate(menu.served_date)}</p>
                      <p className="fa-menuname">{menu.title}</p>

                      <div className="fa-tagrow">
                        {!menu.allergen_checked ? (
                          <span className="fa-tag fa-tag--unknown">？ アレルギー未確認</span>
                        ) : usedAllergens(menu.allergens).length === 0 ? (
                          <span className="fa-tag fa-tag--none">✓ 該当なし</span>
                        ) : (
                          usedAllergens(menu.allergens).map((a) => (
                            <span key={a.key} className="fa-tag">{a.emoji} {a.label}</span>
                          ))
                        )}
                      </div>

                      <div className="fa-btnrow">
                        <button onClick={() => startEdit(menu)} className="fa-btn fa-btn--sky">編集する</button>
                        <button onClick={() => deleteMenu(menu.id)} className="fa-btn fa-btn--rose">削除する</button>
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
            <h2 className="fa-sectiontitle">保護者からの質問</h2>

            {messages.length === 0 && (
              <p className="fa-empty">まだ質問はありません。届くとここに並びます。</p>
            )}

            <div className="fa-grid fa-grid--2">
              {messages.map((msg) => (
                <article key={msg.id} className="fa-card">
                  <p className="fa-date">
                    {formatDate(msg.menus?.served_date)}　{msg.menus?.title}
                  </p>
                  <div className="fa-bubble">
                    <p className="fa-sender">👤 {msg.sender_name}</p>
                    <p className="fa-body">{msg.body}</p>
                  </div>
                  <div className="fa-replyrow">
                    <textarea value={replyBody[msg.id] || ''} rows={2}
                      onChange={(e) => setReplyBody({ ...replyBody, [msg.id]: e.target.value })}
                      placeholder="返信を入力…" className="fa-input fa-textarea" />
                    <button onClick={() => handleReply(msg.menu_id, msg.id)}
                      disabled={!replyBody[msg.id]?.trim() || replyingId === msg.id}
                      className="fa-btn fa-btn--primary fa-btn--send">
                      {replyingId === msg.id ? '送信中…' : '返信する'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---------- 園児・PIN ---------- */}
        {activeTab === 'children' && (
          <ChildrenPanel onNotify={notify} />
        )}
      </div>
    </main>
  )
}