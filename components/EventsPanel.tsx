/* components/EventsPanel.tsx — 管理画面「食育」タブ
 *
 * 食育イベントの登録・編集・削除。
 * 予告と記録は event_date で自動判定するので、切り替え操作は不要。
 */
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { SCHOOL_ID, formatDate } from '@/lib/menu'
import { phaseOf, phaseLabel, isAhead } from '@/lib/eventStatus'

const emptyForm = () => ({
  id: '',
  event_date: '',
  title: '',
  description: '',
  photo_url: '',
  recipe_title: '',
  recipe_ingredients: '',
  recipe_steps: '',
})

type EventForm = ReturnType<typeof emptyForm>

const toArray = (text: string): string[] =>
  text.split(/[\n、,・]+/).map((s) => s.trim()).filter(Boolean)

const toText = (list?: string[] | null): string =>
  Array.isArray(list) ? list.join('、') : ''

export default function EventsPanel({
  onNotify,
}: {
  onNotify: (msg: string, isError?: boolean) => void
}) {
  const [events, setEvents] = useState<any[]>([])
  const [form, setForm] = useState<EventForm>(emptyForm())
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ahead' | 'nophoto'>('all')

  const fetchEvents = useCallback(async () => {
    const res = await fetch('/api/admin/events')
    const json = await res.json()
    if (res.ok) setEvents(json.events)
    else onNotify(json.error ?? '取得できませんでした', true)
  }, [onNotify])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  /* 終わったのに写真がないもの＝記録の入力待ち */
  const needsRecord = useMemo(
    () => events.filter((e) => phaseOf(e.event_date) === 'past' && !e.photo_url),
    [events]
  )

  const shown = useMemo(() => {
    if (filter === 'ahead') return events.filter(isAhead)
    if (filter === 'nophoto') return needsRecord
    return events
  }, [events, filter, needsRecord])

  /* ---------------- 写真 ---------------- */

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()
    const fileName = `${SCHOOL_ID}/event-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-photos').upload(fileName, file)
    if (error) {
      onNotify('写真をアップロードできませんでした。' + error.message, true)
      return null
    }
    const { data } = supabase.storage.from('menu-photos').getPublicUrl(fileName)
    return data.publicUrl
  }

  /* ---------------- 保存 ---------------- */

  const startNew = () => {
    setForm(emptyForm())
    setEditing(true)
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const startEdit = (e: any) => {
    setForm({
      id: e.id,
      event_date: e.event_date ?? '',
      title: e.title ?? '',
      description: e.description ?? '',
      photo_url: e.photo_url ?? '',
      recipe_title: e.recipe_title ?? '',
      recipe_ingredients: toText(e.recipe_ingredients),
      recipe_steps: e.recipe_steps ?? '',
    })
    setEditing(true)
    setPhotoFile(null)
    setPhotoPreview(e.photo_url ?? null)
  }

  const cancel = () => {
    setEditing(false)
    setForm(emptyForm())
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const save = async () => {
    if (!form.event_date || !form.title.trim()) {
      onNotify('日付と行事名を入力してください。', true)
      return
    }

    setLoading(true)

    let photoUrl = form.photo_url || null
    if (photoFile) {
      const uploaded = await uploadPhoto(photoFile)
      if (!uploaded) { setLoading(false); return }
      photoUrl = uploaded
    }

    const payload = {
      id: form.id || undefined,
      event_date: form.event_date,
      title: form.title.trim(),
      description: form.description,
      photo_url: photoUrl,
      recipe_title: form.recipe_title,
      recipe_ingredients: toArray(form.recipe_ingredients),
      recipe_steps: form.recipe_steps,
    }

    const res = await fetch('/api/admin/events', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { onNotify(json.error, true); return }

    onNotify(form.id ? '食育の内容を更新しました。' : '食育イベントを登録しました。')
    cancel()
    fetchEvents()
  }

  const remove = async (e: any) => {
    if (!confirm(`「${e.title}」を削除します。元に戻せません。`)) return

    const res = await fetch('/api/admin/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id }),
    })
    const json = await res.json()

    if (!res.ok) { onNotify(json.error, true); return }

    onNotify('削除しました。')
    fetchEvents()
  }

  /* ================================================================
     入力フォーム
     ================================================================ */
  if (editing) {
    return (
      <section className="fa-card" style={{ maxWidth: 640 }}>
        <h2 className="fa-cardtitle">
          {form.id ? '食育の内容を編集する' : '食育イベントを登録する'}
        </h2>
        <p className="fa-note" style={{ marginTop: 8 }}>
          日付が未来なら「予告」、当日は「本日開催」、過ぎると「記録」として
          保護者の画面に出ます。切り替えの操作は不要です。
        </p>

        <label className="fa-label">日付 <span className="fa-req">必須</span></label>
        <input
          type="date"
          value={form.event_date}
          onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          className="fa-input"
        />

        <label className="fa-label">行事名 <span className="fa-req">必須</span></label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="例：とうもろこしの皮むき体験"
          className="fa-input"
        />

        <label className="fa-label">説明・ようす</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          placeholder="予告のうちは「何をするか」、終わったら「どうだったか」を書いてください"
          className="fa-input fa-textarea"
        />

        <label className="fa-label">写真</label>
        <div className="fa-drop" onClick={() => document.getElementById('event-photo')?.click()}>
          {photoPreview ? (
            <img src={photoPreview} alt="選んだ写真" className="fa-preview" />
          ) : (
            <div className="fa-drop-empty">
              <span className="fa-drop-icon">📷</span>
              <span className="fa-drop-text">タップして写真を選ぶ</span>
              <span className="fa-drop-sub">行事のあとで足せます</span>
            </div>
          )}
        </div>
        <input id="event-photo" type="file" accept="image/*" onChange={handlePhoto} hidden />

        <div className="fa-tint fa-tint--green" style={{ marginTop: 18 }}>
          <h3 className="fa-tinttitle">おうちで作れるレシピ（任意）</h3>
          <p className="fa-note" style={{ marginBottom: 10 }}>
            入力すると、保護者の「家でやる食育」タブに出ます。
          </p>

          <label className="fa-label" style={{ marginTop: 0 }}>レシピ名</label>
          <input
            type="text"
            value={form.recipe_title}
            onChange={(e) => setForm({ ...form, recipe_title: e.target.value })}
            placeholder="例：とうもろこしごはん"
            className="fa-input"
          />

          <label className="fa-label">材料</label>
          <textarea
            value={form.recipe_ingredients}
            onChange={(e) => setForm({ ...form, recipe_ingredients: e.target.value })}
            rows={3}
            placeholder="米2合、とうもろこし1本、塩小さじ1（読点か改行で区切ってください）"
            className="fa-input fa-textarea"
          />

          <label className="fa-label">作り方</label>
          <textarea
            value={form.recipe_steps}
            onChange={(e) => setForm({ ...form, recipe_steps: e.target.value })}
            rows={5}
            placeholder="1. とうもろこしの実を包丁でそぎ落とす&#10;2. 米と一緒に炊く"
            className="fa-input fa-textarea"
          />
        </div>

        <div className="fa-btnrow">
          <button onClick={save} disabled={loading} className="fa-btn fa-btn--primary">
            {loading ? '保存中…' : '保存する'}
          </button>
          <button onClick={cancel} className="fa-btn fa-btn--ghost">やめる</button>
        </div>
      </section>
    )
  }

  /* ================================================================
     一覧
     ================================================================ */
  return (
    <section>
      {needsRecord.length > 0 && (
        <div className="fa-warnbox" style={{ marginBottom: 18 }}>
          <p className="fa-warntitle">
            記録がまだの食育が{needsRecord.length}件あります
          </p>
          <p className="fa-warntext">
            終わった行事に写真とようすを足すと、保護者の「食育のあしあと」に並びます。
          </p>
          <button
            onClick={() => setFilter('nophoto')}
            className="fa-btn fa-btn--sky"
            style={{ marginTop: 10, flex: '0 0 auto' }}
          >
            記録がまだのものを見る
          </button>
        </div>
      )}

      <div className="fa-listhead">
        <h2 className="fa-sectiontitle" style={{ marginBottom: 0 }}>食育イベント</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`fa-filterbtn${filter === 'all' ? ' is-on' : ''}`}
            onClick={() => setFilter('all')}
          >
            すべて（{events.length}）
          </button>
          <button
            className={`fa-filterbtn${filter === 'ahead' ? ' is-on' : ''}`}
            onClick={() => setFilter('ahead')}
          >
            これから（{events.filter(isAhead).length}）
          </button>
          {needsRecord.length > 0 && (
            <button
              className={`fa-filterbtn${filter === 'nophoto' ? ' is-on' : ''}`}
              onClick={() => setFilter('nophoto')}
            >
              記録がまだ（{needsRecord.length}）
            </button>
          )}
        </div>
      </div>

      <button onClick={startNew} className="fa-reusebtn" style={{ marginBottom: 16 }}>
        <span className="fa-reuseicon">🌾</span>
        <span>
          <span className="fa-reusetitle">食育イベントを登録する</span>
          <span className="fa-reusesub">予告として先に登録し、あとで写真を足せます</span>
        </span>
      </button>

      {shown.length === 0 && (
        <p className="fa-empty">
          {filter === 'all'
            ? 'まだ食育イベントがありません。'
            : '該当するイベントはありません。'}
        </p>
      )}

      <div className="fa-grid">
        {shown.map((e) => {
          const phase = phaseOf(e.event_date)
          return (
            <article key={e.id} className="fa-card">
              {e.photo_url && <img src={e.photo_url} alt="" className="fa-thumb" />}

              <p className="fa-date">
                {formatDate(e.event_date)}
                <span className={`fa-phase fa-phase--${phase}`}>{phaseLabel(phase)}</span>
              </p>
              <p className="fa-menuname">{e.title}</p>

              <div className="fa-tagrow">
                {phase === 'past' && !e.photo_url && (
                  <span className="fa-tag fa-tag--unknown">写真がまだ</span>
                )}
                {e.recipe_title && (
                  <span className="fa-tag fa-tag--none">🍳 レシピあり</span>
                )}
              </div>

              <div className="fa-btnrow">
                <button onClick={() => startEdit(e)} className="fa-btn fa-btn--sky">編集</button>
                <button onClick={() => remove(e)} className="fa-btn fa-btn--rose">削除</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}