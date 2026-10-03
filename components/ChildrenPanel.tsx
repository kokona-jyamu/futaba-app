/* components/ChildrenPanel.tsx — 管理画面の「園児」タブ */
'use client'

import { useState, useMemo } from 'react'
import { useLoadEffect, fetchJson, type FetchResult } from '@/lib/useLoadEffect'
import type { ChildListItem, ChildrenListResponse, ChildrenBulkResponse, BulkChildResult } from '@/lib/apiTypes'
import { initialOf } from '@/lib/guardian'
import { usedAllergens, allergenDiff, isAllergyPending, findAllergen } from '@/lib/allergens'
import AllergenPicker from '@/components/AllergenPicker'

/** 一覧の1件（API の応答の形をそのまま使う） */
type Child = ChildListItem

const formatJstDate = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })

/** 発行直後のPIN。印刷用に一時保持するだけでDBには残らない */
type Issued = {
  login_no: string
  name: string
  class_name: string | null
  pin: string
}

type Loaded = FetchResult<ChildrenListResponse>

/* 取得だけ行う（画面への反映は apply で行う） */
const request = () => fetchJson<ChildrenListResponse>('/api/admin/children/list')

export default function ChildrenPanel({
  onNotify,
  onAllergyChange,
}: {
  onNotify: (msg: string, isError?: boolean) => void
  /** アレルギーの編集・確認のあと（管理画面上部の通知を更新するため） */
  onAllergyChange?: () => void
}) {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'list' | 'single' | 'bulk'>('list')
  const [issued, setIssued] = useState<Issued[]>([])
  const [keyword, setKeyword] = useState('')

  /* 単票登録 */
  const [form, setForm] = useState({ login_no: '', name: '', class_name: '' })

  /* 一括登録 */
  const [bulkText, setBulkText] = useState('')

  /* アレルギーの編集 */
  const [allergyChildId, setAllergyChildId] = useState<string | null>(null)
  const [allergyDraft, setAllergyDraft] = useState<Record<string, boolean>>({})
  const [onlyPending, setOnlyPending] = useState(false)

  const apply = ({ ok, json }: Loaded) => {
    if (ok) setChildren(json.children)
    else onNotify(json.error ?? '一覧を取得できませんでした', true)
  }
  useLoadEffect(request, apply)
  /* 保存などのあとに取り直す */
  const fetchChildren = () => request().then(apply)

  /* ---------------- 単票登録 ---------------- */

  const handleAdd = async () => {
    if (!form.login_no.trim() || !form.name.trim()) {
      onNotify('出席番号と園児名を入力してください。', true)
      return
    }
    setLoading(true)
    const res = await fetch('/api/admin/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { onNotify(json.error, true); return }

    setIssued([{
      login_no: json.child.login_no,
      name: json.child.name,
      class_name: json.child.class_name,
      pin: json.pin,
    }])
    setForm({ login_no: '', name: '', class_name: '' })
    onNotify(`${json.child.name}さんを登録しました。`)
    fetchChildren()
  }

  /* ---------------- 一括登録 ---------------- */

  const parsedRows = useMemo(() => {
    return bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        /* タブ区切り（Excelから貼付）とカンマ区切りの両方を受ける */
        const cols = line.includes('\t') ? line.split('\t') : line.split(',')
        return {
          login_no: (cols[0] ?? '').trim(),
          name: (cols[1] ?? '').trim(),
          class_name: (cols[2] ?? '').trim() || null,
        }
      })
      .filter((r) => r.login_no && r.name)
  }, [bulkText])

  const handleBulk = async () => {
    if (parsedRows.length === 0) {
      onNotify('読み取れる行がありません。', true)
      return
    }
    setLoading(true)
    const r = await fetchJson<ChildrenBulkResponse>('/api/admin/children/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: parsedRows }),
    })
    setLoading(false)

    if (!r.ok) { onNotify(r.json.error, true); return }
    const json = r.json

    const ok = json.results.filter((x): x is Extract<BulkChildResult, { ok: true }> => x.ok)
    setIssued(ok)
    setBulkText('')

    const failed = json.results.filter((x): x is Extract<BulkChildResult, { ok: false }> => !x.ok)
    if (failed.length > 0) {
      onNotify(
        `${json.succeeded}件を登録しました。${json.failed}件は失敗（${failed[0].login_no}: ${failed[0].error} ほか）`,
        true
      )
    } else {
      onNotify(`${json.succeeded}件を登録しました。`)
    }
    fetchChildren()
  }

  /* ---------------- PIN再発行・削除 ---------------- */

  const handleReissue = async (child: Child) => {
    if (!confirm(`${child.name}さんのPINを再発行します。今までのPINは使えなくなります。`)) return
    setLoading(true)
    const res = await fetch('/api/admin/children', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: child.id }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { onNotify(json.error, true); return }

    setIssued([{
      login_no: child.login_no,
      name: child.name,
      class_name: child.class_name,
      pin: json.pin,
    }])
    onNotify(`${child.name}さんのPINを再発行しました。`)
  }

  const handleDelete = async (child: Child) => {
    if (!confirm(`${child.name}さんを削除します。保護者はログインできなくなります。`)) return
    const res = await fetch('/api/admin/children', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: child.id }),
    })
    const json = await res.json()
    if (!res.ok) { onNotify(json.error, true); return }
    onNotify(`${child.name}さんを削除しました。`)
    fetchChildren()
  }

  /* ---------------- アレルギーの編集 ---------------- */

  const startAllergyEdit = (child: Child) => {
    setAllergyChildId(child.id)
    setAllergyDraft({ ...(child.allergens ?? {}) })
  }

  const saveAllergy = async (child: Child) => {
    setLoading(true)
    const res = await fetch('/api/admin/children/allergens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: child.id, allergens: allergyDraft }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { onNotify(json.error, true); return }

    setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, ...json.child } : c)))
    setAllergyChildId(null)
    onNotify(`${child.name}さんのアレルギー情報を保存しました。`)
    onAllergyChange?.()
  }

  /* 保護者が変更した内容を、画面に出ている内容のまま確認済みにする */
  const confirmAllergy = async (child: Child) => {
    setLoading(true)
    const res = await fetch('/api/admin/children/allergens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: child.id, confirm: true, expected: child.allergens }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      onNotify(json.error, true)
      if (res.status === 409) fetchChildren()
      return
    }

    setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, ...json.child } : c)))
    onNotify(`${child.name}さんのアレルギー情報を確認済みにしました。`)
    onAllergyChange?.()
  }

  /* ---------------- 絞り込み ---------------- */

  const pendingCount = useMemo(
    () => children.filter((c) => isAllergyPending(c.allergens, c.allergens_confirmed)).length,
    [children]
  )

  const filtered = useMemo(() => {
    const k = keyword.trim()
    return children
      .filter((c) => !onlyPending || isAllergyPending(c.allergens, c.allergens_confirmed))
      .filter(
        (c) => !k || c.name.includes(k) || c.login_no.includes(k) || (c.class_name ?? '').includes(k)
      )
  }, [children, keyword, onlyPending])

  /* ================================================================
     PIN配布用の紙（印刷時はこれだけが出る）
     ================================================================ */
  if (issued.length > 0) {
    return (
      <div>
        <div className="fa-noprint" style={{ marginBottom: 16 }}>
          <div className="fa-tint fa-tint--apricot" style={{ marginTop: 0 }}>
            <h2 className="fa-tinttitle fa-tinttitle--apricot">
              PINは今だけ表示されます
            </h2>
            <p style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--fa-ink-2)' }}>
              PINは暗号化して保存されるため、この画面を閉じると二度と確認できません。
              印刷して保護者へお渡しください。忘れた場合は再発行になります。
            </p>
          </div>
          <div className="fa-btnrow">
            <button onClick={() => window.print()} className="fa-btn fa-btn--primary">
              印刷する（{issued.length}枚）
            </button>
            <button
              onClick={() => { if (confirm('印刷は済みましたか？この画面を閉じるとPINは確認できなくなります。')) setIssued([]) }}
              className="fa-btn fa-btn--ghost"
            >
              閉じる
            </button>
          </div>
        </div>

        <div className="fa-slips">
          {issued.map((s) => (
            <div key={s.login_no} className="fa-slip">
              <p className="fa-slip-brand">🌱 ふたば保育園　給食・食育ポータル</p>
              <p className="fa-slip-name">
                {s.class_name && <span className="fa-slip-class">{s.class_name}　</span>}
                {s.name} さん の保護者さまへ
              </p>
              <div className="fa-slip-box">
                <div>
                  <p className="fa-slip-label">出席番号</p>
                  <p className="fa-slip-value">{s.login_no}</p>
                </div>
                <div>
                  <p className="fa-slip-label">PIN（4桁）</p>
                  <p className="fa-slip-value">{s.pin}</p>
                </div>
              </div>
              <p className="fa-slip-note">
                アプリを開き、この出席番号とPINを入力するとログインできます。
                PINは他の方に教えないでください。分からなくなった場合は担任にお声がけください。
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ================================================================
     通常表示
     ================================================================ */
  return (
    <div>
      <div className="fa-tabs" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginTop: 0, marginBottom: 18 }}>
        <button className={`fa-tab${mode === 'list' ? ' is-on' : ''}`} onClick={() => setMode('list')}>
          園児一覧
          {children.length > 0 && <span className="fa-badge">{children.length}</span>}
        </button>
        <button className={`fa-tab${mode === 'single' ? ' is-on' : ''}`} onClick={() => setMode('single')}>
          1人ずつ追加
        </button>
        <button className={`fa-tab${mode === 'bulk' ? ' is-on' : ''}`} onClick={() => setMode('bulk')}>
          名簿から一括
        </button>
      </div>

      {/* ---------- 一覧 ---------- */}
      {mode === 'list' && (
        <>
          {pendingCount > 0 && (
            <div className="fa-warnbox" style={{ marginBottom: 14 }}>
              <p className="fa-warntitle">
                保護者が変更したアレルギー情報が{pendingCount}件あります（未確認）
              </p>
              <p className="fa-warntext">
                確認が済むまで、食数では変更前と変更後の両方を除去の対象にしています。
                内容を確かめて「確認済みにする」を押してください。
              </p>
              <button
                onClick={() => setOnlyPending(!onlyPending)}
                className="fa-btn fa-btn--sky"
                style={{ marginTop: 10, flex: '0 0 auto' }}
              >
                {onlyPending ? 'すべての園児を表示' : '未確認の園児だけを見る'}
              </button>
            </div>
          )}

          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="名前・出席番号・クラスで絞り込み"
            className="fa-input"
            style={{ marginBottom: 14 }}
          />

          {filtered.length === 0 && (
            <p className="fa-empty">
              {children.length === 0
                ? 'まだ園児が登録されていません。「名簿から一括」で名簿を貼り付けると一度に登録できます。'
                : '該当する園児がいません。'}
            </p>
          )}

          <div className="fa-grid">
            {filtered.map((c) => (
              <article key={c.id} className="fa-card fa-childcard">
                <div className="fa-childhead">
                  <span className="fa-avatar">{initialOf(c.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <p className="fa-date">
                      {c.class_name ?? 'クラス未設定'}　No.{c.login_no}
                    </p>
                    <p className="fa-menuname">{c.name}</p>
                  </div>
                </div>

                <p className="fa-childstatus">
                  {c.last_seen_at
                    ? `最終ログイン：${new Date(c.last_seen_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
                    : 'まだログインされていません'}
                </p>

                {allergyChildId === c.id ? (
                  <div className="fa-tint fa-tint--apricot">
                    <h3 className="fa-tinttitle fa-tinttitle--apricot">
                      アレルギー<span className="fa-hint">タップで切り替え</span>
                    </h3>
                    <AllergenPicker
                      value={allergyDraft}
                      onToggle={(key) => setAllergyDraft((a) => ({ ...a, [key]: !a[key] }))}
                    />
                    <p className="fa-note" style={{ marginTop: 10 }}>
                      保護者のマイページにも同じ内容が表示されます。
                    </p>
                    <div className="fa-btnrow">
                      <button onClick={() => saveAllergy(c)} disabled={loading} className="fa-btn fa-btn--primary">
                        {loading ? '保存中…' : '保存する'}
                      </button>
                      <button onClick={() => setAllergyChildId(null)} className="fa-btn fa-btn--ghost">
                        やめる
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="fa-tagrow">
                      {usedAllergens(c.allergens).length === 0 ? (
                        <span className="fa-tag fa-tag--plain">アレルギーの登録なし</span>
                      ) : (
                        usedAllergens(c.allergens).map((a) => (
                          <span key={a.key} className="fa-tag">{a.emoji} {a.label}</span>
                        ))
                      )}
                    </div>

                    {c.allergens_updated_at && (
                      <p className="fa-childstatus">
                        アレルギー最終更新：{formatJstDate(c.allergens_updated_at)}
                        （{c.allergens_updated_by_role === 'staff' ? '職員' : '保護者'}）
                      </p>
                    )}

                    {isAllergyPending(c.allergens, c.allergens_confirmed) && (() => {
                      const { added, removed } = allergenDiff(c.allergens, c.allergens_confirmed)
                      const label = (k: string) => findAllergen(k).label
                      return (
                        <div className="fa-warnbox" style={{ marginTop: 10 }}>
                          <p className="fa-warntitle">保護者の変更・未確認</p>
                          <p className="fa-warntext">
                            {added.length > 0 && <>追加：{added.map(label).join('・')}<br /></>}
                            {removed.length > 0 && <>削除：{removed.map(label).join('・')}</>}
                          </p>
                          <button
                            onClick={() => confirmAllergy(c)}
                            disabled={loading}
                            className="fa-btn fa-btn--primary"
                            style={{ marginTop: 10, flex: '0 0 auto' }}
                          >
                            確認済みにする
                          </button>
                        </div>
                      )
                    })()}
                  </>
                )}

                <div className="fa-btnrow">
                  {allergyChildId !== c.id && (
                    <button onClick={() => startAllergyEdit(c)} className="fa-btn fa-btn--sky">
                      アレルギーを編集
                    </button>
                  )}
                  <button onClick={() => handleReissue(c)} disabled={loading} className="fa-btn fa-btn--sky">
                    PIN再発行
                  </button>
                  <button onClick={() => handleDelete(c)} className="fa-btn fa-btn--rose">
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* ---------- 1人ずつ ---------- */}
      {mode === 'single' && (
        <section className="fa-card" style={{ maxWidth: 520 }}>
          <h2 className="fa-cardtitle">園児を1人追加する</h2>

          <label className="fa-label">出席番号 <span className="fa-req">必須</span></label>
          <input
            type="text" inputMode="numeric" value={form.login_no}
            onChange={(e) => setForm({ ...form, login_no: e.target.value })}
            placeholder="例：12" className="fa-input"
          />

          <label className="fa-label">園児名 <span className="fa-req">必須</span></label>
          <input
            type="text" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例：ふたば さくら" className="fa-input"
          />

          <label className="fa-label">クラス</label>
          <input
            type="text" value={form.class_name}
            onChange={(e) => setForm({ ...form, class_name: e.target.value })}
            placeholder="例：ひまわり組" className="fa-input"
          />

          <div className="fa-actions" style={{ display: 'block' }}>
            <button onClick={handleAdd} disabled={loading} className="fa-btn fa-btn--primary" style={{ width: '100%' }}>
              {loading ? '登録中…' : '登録してPINを発行'}
            </button>
          </div>
        </section>
      )}

      {/* ---------- 一括 ---------- */}
      {mode === 'bulk' && (
        <section className="fa-card">
          <h2 className="fa-cardtitle">名簿から一括登録する</h2>

          <div className="fa-tint fa-tint--green">
            <h3 className="fa-tinttitle">貼り付け方</h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--fa-ink-2)' }}>
              Excelで「出席番号／園児名／クラス」の3列を選んでコピーし、下の欄に貼り付けてください。
              カンマ区切りでも読み取れます。クラスは省略できます。
            </p>
            <pre className="fa-sample">{`1,ふたば さくら,ひまわり組
2,みどり たろう,ひまわり組
3,そら はなこ,つぼみ組`}</pre>
          </div>

          <label className="fa-label">名簿</label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={12}
            placeholder="ここに貼り付け"
            className="fa-input fa-textarea"
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />

          {parsedRows.length > 0 && (
            <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--fa-matcha-deep)', fontWeight: 700 }}>
              {parsedRows.length}件を読み取りました（先頭：No.{parsedRows[0].login_no} {parsedRows[0].name}）
            </p>
          )}

          <div className="fa-actions" style={{ display: 'block' }}>
            <button
              onClick={handleBulk}
              disabled={loading || parsedRows.length === 0}
              className="fa-btn fa-btn--primary"
              style={{ width: '100%' }}
            >
              {loading ? `登録中…（${parsedRows.length}件）` : `${parsedRows.length}件を登録してPINを発行`}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}