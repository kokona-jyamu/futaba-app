/* components/ClassPanel.tsx — クラスの管理と進級・卒園
 *
 * 所属は履歴で持つので、進級しても過去の記録は残る。
 * 進級は「まとめて移す」画面で一度に済ませられる。
 */
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { todayStr, formatShort } from '@/lib/attendance'

type Mode = 'list' | 'promote'

export default function ClassPanel({
  onNotify,
}: {
  onNotify: (msg: string, isError?: boolean) => void
}) {
  const [classes, setClasses] = useState<any[]>([])
  const [children, setChildren] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('list')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingChild, setEditingChild] = useState<string | null>(null)
  const [pick, setPick] = useState({ class_id: '', start_date: todayStr() })
  const [showGraduated, setShowGraduated] = useState(false)

  /* 進級画面の状態 */
  const [promoteDate, setPromoteDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear() + (d.getMonth() >= 3 ? 1 : 0)}-04-01`
  })
  const [plan, setPlan] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/classes')
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { onNotify(json.error ?? '取得できませんでした', true); return }
    setClasses(json.classes)
    setChildren(json.children)
  }, [onNotify])

  useEffect(() => { fetchData() }, [fetchData])

  const nameOf = (id?: string | null) =>
    classes.find((c) => c.id === id)?.name ?? null

  const active = useMemo(() => children.filter((c) => c.is_active), [children])
  const graduated = useMemo(() => children.filter((c) => !c.is_active), [children])

  /* クラスごとにまとめる */
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>()
    active.forEach((c) => {
      const key = c.class_id ?? '__none'
      const list = map.get(key) ?? []
      list.push(c)
      map.set(key, list)
    })
    return map
  }, [active])

  /* ---------------- クラスの追加 ---------------- */

  const addClass = async () => {
    if (!newName.trim()) { onNotify('クラス名を入力してください。', true); return }

    const res = await fetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        sort_order: (classes.length + 1) * 10,
      }),
    })
    const json = await res.json()
    if (!res.ok) { onNotify(json.error, true); return }

    onNotify(`「${newName.trim()}」を追加しました。`)
    setNewName('')
    setShowForm(false)
    fetchData()
  }

  /* ---------------- 1人ずつの変更 ---------------- */

  const startAssign = (c: any) => {
    setEditingChild(c.id)
    setPick({ class_id: c.class_id ?? '', start_date: todayStr() })
  }

  const saveAssign = async (childId: string) => {
    if (!pick.class_id) { onNotify('クラスを選んでください。', true); return }

    const res = await fetch('/api/admin/classes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child_id: childId,
        class_id: pick.class_id,
        start_date: pick.start_date,
      }),
    })
    const json = await res.json()
    if (!res.ok) { onNotify(json.error, true); return }

    onNotify('クラスを変更しました。')
    setEditingChild(null)
    fetchData()
  }

  const restore = async (c: any) => {
    if (!confirm(`${c.name}さんを在籍に戻します。`)) return

    const res = await fetch('/api/admin/classes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reactivate', child_id_to_restore: c.id }),
    })
    const json = await res.json()
    if (!res.ok) { onNotify(json.error, true); return }

    onNotify('在籍に戻しました。')
    fetchData()
  }

  /* ---------------- 進級 ---------------- */

  const startPromote = () => {
    /* 初期値として、いまのクラスをそのまま置く */
    const init: Record<string, string> = {}
    active.forEach((c) => { init[c.id] = c.class_id ?? '' })
    setPlan(init)
    setMode('promote')
  }

  /* クラス単位でまとめて指定する */
  const setClassPlan = (fromClassId: string, toValue: string) => {
    setPlan((prev) => {
      const next = { ...prev }
      active
        .filter((c) => (c.class_id ?? '__none') === fromClassId)
        .forEach((c) => { next[c.id] = toValue })
      return next
    })
  }

  const runPromote = async () => {
    const moves: { child_id: string; class_id: string }[] = []
    const graduates: string[] = []

    Object.entries(plan).forEach(([childId, to]) => {
      if (to === '__graduate') graduates.push(childId)
      else if (to && to !== children.find((c) => c.id === childId)?.class_id) {
        moves.push({ child_id: childId, class_id: to })
      }
    })

    if (moves.length === 0 && graduates.length === 0) {
      onNotify('変更がありません。', true)
      return
    }

    const msg =
      `${moves.length}名のクラスを変更し、${graduates.length}名を卒園にします。` +
      `\n適用日：${formatShort(promoteDate)}\n\nよろしいですか。`
    if (!confirm(msg)) return

    setSaving(true)
    const res = await fetch('/api/admin/classes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'promote',
        moves, graduates, start_date: promoteDate,
      }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { onNotify(json.error, true); return }

    onNotify(`${json.promoted}名を進級、${json.graduated}名を卒園にしました。`)
    setMode('list')
    fetchData()
  }

  if (loading) return <p className="fa-empty">読み込んでいます…</p>

  /* ================================================================
     進級の画面
     ================================================================ */
  if (mode === 'promote') {
    const classKeys = [...grouped.keys()]

    return (
      <section>
        <div className="fa-listhead">
          <h2 className="fa-sectiontitle" style={{ marginBottom: 0 }}>
            進級・卒園の処理
          </h2>
          <button onClick={() => setMode('list')} className="fa-filterbtn">
            やめる
          </button>
        </div>

        <div className="fa-card" style={{ marginBottom: 18 }}>
          <label className="fa-label" style={{ marginTop: 0 }}>いつから</label>
          <input
            type="date"
            value={promoteDate}
            onChange={(e) => setPromoteDate(e.target.value)}
            className="fa-input"
            style={{ maxWidth: 220 }}
          />
          <p className="fa-note" style={{ marginTop: 8 }}>
            この日から新しいクラスになります。
            それ以前の記録は、元のクラスのまま残ります。
          </p>
        </div>

        {classKeys.map((key) => {
          const kids = grouped.get(key) ?? []
          const label = key === '__none' ? 'クラス未設定' : nameOf(key)
          /* このクラスの子が全員同じ行き先なら、それを選択中として表示 */
          const dests = new Set(kids.map((k) => plan[k.id] ?? ''))
          const common = dests.size === 1 ? [...dests][0] : ''

          return (
            <section key={key} className="fa-card" style={{ marginBottom: 14 }}>
              <div className="fa-listhead">
                <h3 className="fa-cardtitle" style={{ marginBottom: 0 }}>
                  {label}
                  <span className="fa-countbadge">{kids.length}名</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="fa-note">まとめて</span>
                  <select
                    value={common}
                    onChange={(e) => setClassPlan(key, e.target.value)}
                    className="fa-input fa-input--sm"
                    style={{ width: 'auto' }}
                  >
                    <option value="">選んでください</option>
                    {classes.filter((c) => c.is_active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}へ</option>
                    ))}
                    <option value="__graduate">卒園にする</option>
                  </select>
                </div>
              </div>

              <div className="fa-promotelist">
                {kids.map((c) => {
                  const to = plan[c.id] ?? ''
                  const isGrad = to === '__graduate'
                  const changed = to && to !== c.class_id
                  return (
                    <div
                      key={c.id}
                      className={`fa-promoterow${isGrad ? ' is-grad' : changed ? ' is-changed' : ''}`}
                    >
                      <span className="fa-promotename">
                        {c.name}
                        <span className="fa-attclass">No.{c.login_no}</span>
                      </span>
                      <select
                        value={to}
                        onChange={(e) => setPlan({ ...plan, [c.id]: e.target.value })}
                        className="fa-input fa-input--sm"
                        style={{ width: 'auto', minWidth: 130 }}
                      >
                        <option value="">そのまま</option>
                        {classes.filter((cl) => cl.is_active).map((cl) => (
                          <option key={cl.id} value={cl.id}>{cl.name}</option>
                        ))}
                        <option value="__graduate">卒園</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        <div className="fa-btnrow">
          <button onClick={runPromote} disabled={saving} className="fa-btn fa-btn--primary">
            {saving ? '処理中…' : 'この内容で進級させる'}
          </button>
          <button onClick={() => setMode('list')} className="fa-btn fa-btn--ghost">
            やめる
          </button>
        </div>
      </section>
    )
  }

  /* ================================================================
     一覧の画面
     ================================================================ */
  return (
    <section>
      {/* クラスのマスタ */}
      <section className="fa-card" style={{ marginBottom: 18 }}>
        <div className="fa-listhead">
          <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>クラス</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setShowForm(!showForm)} className="fa-filterbtn">
              {showForm ? '閉じる' : '+ クラスを追加'}
            </button>
            {active.length > 0 && classes.length > 0 && (
              <button onClick={startPromote} className="fa-filterbtn">
                🌸 進級・卒園の処理
              </button>
            )}
          </div>
        </div>

        <div className="fa-typerow">
          {classes.map((cl) => (
            <span key={cl.id} className={`fa-typechip${cl.is_active ? ' is-on' : ''}`}>
              {cl.name}
              <span className="fa-babymark">
                {(grouped.get(cl.id) ?? []).length}名
              </span>
            </span>
          ))}
          {classes.length === 0 && (
            <p className="fa-note">まだクラスがありません。追加してください。</p>
          )}
        </div>

        {showForm && (
          <div className="fa-tint fa-tint--green" style={{ marginTop: 14 }}>
            <label className="fa-label" style={{ marginTop: 0 }}>クラス名</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例：ひまわり組、0歳児クラス など"
              className="fa-input"
            />
            <div className="fa-btnrow">
              <button onClick={addClass} className="fa-btn fa-btn--primary">追加する</button>
            </div>
          </div>
        )}
      </section>

      {/* 園児ごとの所属 */}
      <div className="fa-listhead">
        <h2 className="fa-sectiontitle" style={{ marginBottom: 0 }}>
          園児の所属
        </h2>
        {graduated.length > 0 && (
          <button
            onClick={() => setShowGraduated(!showGraduated)}
            className={`fa-filterbtn${showGraduated ? ' is-on' : ''}`}
          >
            卒園した園児（{graduated.length}）
          </button>
        )}
      </div>

      {!showGraduated && (
        <div className="fa-grid">
          {active.map((c) => (
            <article key={c.id} className="fa-card">
              <p className="fa-date">No.{c.login_no}</p>
              <p className="fa-menuname">{c.name}</p>

              {editingChild === c.id ? (
                <>
                  <label className="fa-label">クラス</label>
                  <select
                    value={pick.class_id}
                    onChange={(e) => setPick({ ...pick, class_id: e.target.value })}
                    className="fa-input"
                  >
                    <option value="">選んでください</option>
                    {classes.filter((cl) => cl.is_active).map((cl) => (
                      <option key={cl.id} value={cl.id}>{cl.name}</option>
                    ))}
                  </select>

                  <label className="fa-label">いつから</label>
                  <input
                    type="date"
                    value={pick.start_date}
                    onChange={(e) => setPick({ ...pick, start_date: e.target.value })}
                    className="fa-input"
                  />

                  <div className="fa-btnrow">
                    <button onClick={() => saveAssign(c.id)} className="fa-btn fa-btn--primary">
                      保存する
                    </button>
                    <button onClick={() => setEditingChild(null)} className="fa-btn fa-btn--ghost">
                      やめる
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="fa-tagrow">
                    {c.class_id ? (
                      <span className="fa-tag fa-tag--none">{nameOf(c.class_id)}</span>
                    ) : (
                      <span className="fa-tag fa-tag--unknown">クラス未設定</span>
                    )}
                    {c.history.length > 1 && (
                      <span className="fa-tag fa-tag--plain">
                        これまで{c.history.length}クラス
                      </span>
                    )}
                  </div>
                  <div className="fa-btnrow">
                    <button onClick={() => startAssign(c)} className="fa-btn fa-btn--sky">
                      クラスを変える
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}

      {showGraduated && (
        <div className="fa-grid">
          {graduated.map((c) => (
            <article key={c.id} className="fa-card">
              <p className="fa-date">No.{c.login_no}</p>
              <p className="fa-menuname">{c.name}</p>
              <div className="fa-tagrow">
                <span className="fa-tag fa-tag--plain">
                  {c.graduated_at ? `${formatShort(c.graduated_at)} 卒園` : '卒園'}
                </span>
              </div>
              <div className="fa-btnrow">
                <button onClick={() => restore(c)} className="fa-btn fa-btn--ghost">
                  在籍に戻す
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}