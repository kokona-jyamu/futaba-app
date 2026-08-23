/* app/admin/page.tsx
 *
 * RLS 対応版。menus / messages への書き込みはすべて
 * /api/admin/menus と /api/admin/replies を経由する。
 * 献立の読み取りも、下書きを含めるため API 経由にしている。
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  NUTRIENTS, SCHOOL_ID, num, formatDate,
  parseIngredients, formatIngredients,
} from '@/lib/menu'
import { emptyAllergenState, usedAllergens } from '@/lib/allergens'
import AllergenPicker from '@/components/AllergenPicker'
import ChildrenPanel from '@/components/ChildrenPanel'
import MenuPicker from '@/components/MenuPicker'
import MessagesPanel from '@/components/MessagesPanel'
import MenuBulkPanel from '@/components/MenuBulkPanel'
import MenuPrintPanel from '@/components/MenuPrintPanel'
import TodayDraft from '@/components/TodayDraft'

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

/** 今日の日付を 'YYYY-MM-DD' で返す（日本時間） */
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminPage() {
  const [activeTab, setActiveTab] =
    useState<'post' | 'bulk' | 'edit' | 'print' | 'messages' | 'children'>('post')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const [form, setForm] = useState<MenuForm>(emptyForm())
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null)

  const [allMenus, setAllMenus] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [listFilter, setListFilter] = useState<'all' | 'draft' | 'unchecked'>('all')

  const [messages, setMessages] = useState<any[]>([])

  const notify = (text: string, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  /* ---------------- データ取得 ---------------- */

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/admin/replies')
    const json = await res.json()
    if (res.ok) setMessages(json.messages)
  }, [])

  /* 下書きを含めるため API 経由で取得する */
  const fetchMenus = useCallback(async () => {
    const res = await fetch('/api/admin/menus/list')
    const json = await res.json()
    if (res.ok) setAllMenus(json.menus)
  }, [])

  useEffect(() => {
    fetchMessages()
    fetchMenus()
  }, [fetchMessages, fetchMenus])

  const uncheckedMenus = allMenus.filter((m) => !m.allergen_checked)
  const draftMenus = allMenus.filter((m) => !m.is_published)
  const openCount = messages.filter((m: any) => (m.replies?.length ?? 0) === 0).length

  /* 今日ぶんの下書き（複数あれば全部出す） */
  const todayDrafts = allMenus.filter(
    (m) => !m.is_published && m.served_date === todayStr()
  )

  const shownMenus =
    listFilter === 'draft' ? draftMenus
    : listFilter === 'unchecked' ? uncheckedMenus
    : allMenus

  /* ---------------- 写真 ---------------- */

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

  /* ---------------- 下書きの公開 ---------------- */

  const publishDraft = async (
    id: string,
    patch: { nutritionist_comment: string; why_eat_note: string; photo_url: string | null }
  ): Promise<boolean> => {
    const res = await fetch('/api/admin/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, partial: true, ...patch, is_published: true }),
    })
    const json = await res.json()

    if (!res.ok) {
      notify('公開できませんでした。' + json.error, true)
      return false
    }

    notify('保護者に公開しました。')
    fetchMenus()
    return true
  }

  /* 一覧からの公開・非公開の切り替え */
  const togglePublish = async (menu: any) => {
    const next = !menu.is_published
    if (!next && !confirm('保護者に見えなくなります。よろしいですか。')) return

    const res = await fetch('/api/admin/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: menu.id, partial: true, is_published: next }),
    })
    const json = await res.json()

    if (!res.ok) { notify('変更できませんでした。' + json.error, true); return }

    notify(next ? '公開しました。' : '下書きに戻しました。')
    fetchMenus()
  }

  /* ---------------- 投稿 ---------------- */

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const toggleAllergen = (key: string) =>
    setForm((f) => ({
      ...f,
      allergens: { ...f.allergens, [key]: !f.allergens[key] },
      allergen_checked: true,
    }))

  const declareNone = () =>
    setForm((f) => ({
      ...f,
      allergens: emptyAllergenState(),
      allergen_checked: true,
    }))

  const copyFromMenu = (menu: any) => {
    setForm({
      served_date: todayStr(),
      title: menu.title ?? '',
      ingredient: formatIngredients(menu.ingredients),
      nutritionist_comment: '',
      why_eat_note: '',
      kcal: menu.kcal?.toString() ?? '',
      carb: menu.carb?.toString() ?? '',
      protein: menu.protein?.toString() ?? '',
      fat: menu.fat?.toString() ?? '',
      salt: menu.salt?.toString() ?? '',
      calcium: menu.calcium?.toString() ?? '',
      allergens: { ...emptyAllergenState(), ...(menu.allergens || {}) },
      allergen_checked: menu.allergen_checked ?? false,
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setCopiedFrom(menu.title)
    setMessage('')
  }

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

    const res = await fetch('/api/admin/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        served_date: form.served_date,
        title: form.title,
        ingredients: parseIngredients(form.ingredient),
        nutritionist_comment: form.nutritionist_comment,
        why_eat_note: form.why_eat_note,
        kcal: num(form.kcal), carb: num(form.carb), protein: num(form.protein),
        fat: num(form.fat), salt: num(form.salt), calcium: num(form.calcium),
        allergens: form.allergens,
        allergen_checked: true,
        is_published: true,
        photo_url: photoUrl,
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { notify('保存できませんでした。' + json.error, true); return }

    notify('献立を公開しました。')
    setForm(emptyForm())
    setPhotoFile(null)
    setPhotoPreview(null)
    setCopiedFrom(null)
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

    const res = await fetch('/api/admin/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        served_date: editForm.served_date,
        title: editForm.title,
        ingredients: parseIngredients(editForm.ingredient ?? ''),
        nutritionist_comment: editForm.nutritionist_comment,
        why_eat_note: editForm.why_eat_note,
        kcal: num(editForm.kcal), carb: num(editForm.carb), protein: num(editForm.protein),
        fat: num(editForm.fat), salt: num(editForm.salt), calcium: num(editForm.calcium),
        allergens: editForm.allergens,
        allergen_checked: true,
        is_published: editForm.is_published !== false,
        photo_url: photoUrl,
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { notify('保存できませんでした。' + json.error, true); return }

    setAllMenus((prev) => prev.map((m) => (m.id === editingId ? json.menu : m)))
    notify('献立を更新しました。')
    cancelEdit()
  }

  const deleteMenu = async (id: string) => {
    if (!confirm('この献立を削除します。元に戻せません。')) return

    const res = await fetch('/api/admin/menus', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()

    if (!res.ok) { notify('削除できませんでした。' + json.error, true); return }

    setAllMenus((prev) => prev.filter((m) => m.id !== id))
    notify('献立を削除しました。')
  }

  /* ---------------- 返信 ---------------- */

  const handleReply = async (
    menuId: string,
    questionId: string,
    body: string
  ): Promise<boolean> => {
    const res = await fetch('/api/admin/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_id: menuId, question_id: questionId, body }),
    })
    const json = await res.json()

    if (!res.ok) {
      notify('返信を送れませんでした。' + json.error, true)
      return false
    }

    notify('返信を送りました。')
    fetchMessages()
    return true
  }

  /* ---------------- 描画 ---------------- */

  return (
    <main className="fa-page">
      <header className="fa-head fa-noprint">
        <div>
          <p className="fa-eyebrow">栄養士専用</p>
          <h1 className="fa-title">給食管理</h1>
        </div>
        <nav className="fa-tabs fa-tabs--6" role="tablist">
          <button
            role="tab" aria-selected={activeTab === 'post'}
            className={`fa-tab${activeTab === 'post' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('post')}
          >
            <span className="fa-tab-icon">📝</span>1日ずつ
          </button>
          <button
            role="tab" aria-selected={activeTab === 'bulk'}
            className={`fa-tab${activeTab === 'bulk' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            <span className="fa-tab-icon">📅</span>月間登録
          </button>
          <button
            role="tab" aria-selected={activeTab === 'edit'}
            className={`fa-tab${activeTab === 'edit' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <span className="fa-tab-icon">✏️</span>編集
            {draftMenus.length > 0 && <span className="fa-badge">{draftMenus.length}</span>}
          </button>
          <button
            role="tab" aria-selected={activeTab === 'print'}
            className={`fa-tab${activeTab === 'print' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('print')}
          >
            <span className="fa-tab-icon">🖨️</span>献立表
          </button>
          <button
            role="tab" aria-selected={activeTab === 'messages'}
            className={`fa-tab${activeTab === 'messages' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <span className="fa-tab-icon">💬</span>質問
            {openCount > 0 && <span className="fa-badge">{openCount}</span>}
          </button>
          <button
            role="tab" aria-selected={activeTab === 'children'}
            className={`fa-tab${activeTab === 'children' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('children')}
          >
            <span className="fa-tab-icon">👶</span>園児
          </button>
        </nav>
      </header>

      {message && (
        <p className={`fa-toast fa-noprint${isError ? ' is-error' : ''}`} role="status">
          {message}
        </p>
      )}

      {/* 今日の下書き：どのタブにいても最上部に出す */}
      {activeTab !== 'print' && todayDrafts.map((m) => (
        <TodayDraft
          key={m.id}
          menu={m}
          onPublish={publishDraft}
          onUploadPhoto={uploadPhoto}
        />
      ))}

      {uncheckedMenus.length > 0 && activeTab !== 'edit' && activeTab !== 'print' && (
        <div className="fa-warnbox" style={{ marginBottom: 18 }}>
          <p className="fa-warntitle">
            アレルギー情報が未確認の献立が{uncheckedMenus.length}件あります
          </p>
          <p className="fa-warntext">
            保護者の絞り込み画面では「判断できません」と表示されます。
            「編集」から順に登録してください。
          </p>
          <button
            onClick={() => { setActiveTab('edit'); setListFilter('unchecked') }}
            className="fa-btn fa-btn--sky"
            style={{ marginTop: 10, flex: '0 0 auto' }}
          >
            未確認の献立を見る
          </button>
        </div>
      )}

      <div className="fa-panel-area">

        {/* ---------- 1日ずつ投稿 ---------- */}
        {activeTab === 'post' && (
          <>
            <MenuPicker menus={allMenus} onPick={copyFromMenu} />

            {copiedFrom && (
              <p className="fa-copied">
                「{copiedFrom}」から栄養価とアレルギーを引き継ぎました。
                日付を確認し、写真とコメントを入力してください。
              </p>
            )}

            <div className="fa-cols">
              <section className="fa-card">
                <h2 className="fa-cardtitle">今日の献立</h2>

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
          </>
        )}

        {/* ---------- 月間まとめて登録 ---------- */}
        {activeTab === 'bulk' && (
          <MenuBulkPanel onNotify={notify} onDone={fetchMenus} />
        )}

        {/* ---------- 編集 ---------- */}
        {activeTab === 'edit' && (
          <section>
            <div className="fa-listhead">
              <h2 className="fa-sectiontitle" style={{ marginBottom: 0 }}>
                投稿済みの献立
              </h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className={`fa-filterbtn${listFilter === 'all' ? ' is-on' : ''}`}
                  onClick={() => setListFilter('all')}
                >
                  すべて（{allMenus.length}）
                </button>
                {draftMenus.length > 0 && (
                  <button
                    className={`fa-filterbtn${listFilter === 'draft' ? ' is-on' : ''}`}
                    onClick={() => setListFilter('draft')}
                  >
                    下書き（{draftMenus.length}）
                  </button>
                )}
                {uncheckedMenus.length > 0 && (
                  <button
                    className={`fa-filterbtn${listFilter === 'unchecked' ? ' is-on' : ''}`}
                    onClick={() => setListFilter('unchecked')}
                  >
                    アレルギー未確認（{uncheckedMenus.length}）
                  </button>
                )}
              </div>
            </div>

            {shownMenus.length === 0 && (
              <p className="fa-empty">
                {listFilter === 'all'
                  ? 'まだ献立がありません。「1日ずつ」か「月間登録」から追加してください。'
                  : '該当する献立はありません。'}
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
                            placeholder="読点か改行で区切ってください"
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

                      <p className="fa-date">
                        {formatDate(menu.served_date)}
                        {!menu.is_published && <span className="fa-draftbadge" style={{ marginLeft: 8 }}>下書き</span>}
                      </p>
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
                        <button
                          onClick={() => togglePublish(menu)}
                          className={`fa-btn ${menu.is_published ? 'fa-btn--ghost' : 'fa-btn--primary'}`}
                          style={{ padding: 10, fontSize: 13, width: 'auto' }}
                        >
                          {menu.is_published ? '下書きに戻す' : '公開する'}
                        </button>
                        <button onClick={() => startEdit(menu)} className="fa-btn fa-btn--sky">編集</button>
                        <button onClick={() => deleteMenu(menu.id)} className="fa-btn fa-btn--rose">削除</button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---------- 献立表（印刷・PDF） ---------- */}
        {activeTab === 'print' && (
          <MenuPrintPanel menus={allMenus} />
        )}

        {/* ---------- 質問 ---------- */}
        {activeTab === 'messages' && (
          <MessagesPanel messages={messages} onReply={handleReply} />
        )}

        {/* ---------- 園児・PIN ---------- */}
        {activeTab === 'children' && (
          <ChildrenPanel onNotify={notify} />
        )}
      </div>
    </main>
  )
}