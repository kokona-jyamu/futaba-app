/* components/MealTypePanel.tsx — 食事区分の設定
 *
 * 園ごとに区分を定義し、園児それぞれに割り当てる。
 * 切り替え日を持つので、過去の食数も正確に集計できる。
 */
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { todayStr, formatShort } from '@/lib/attendance'

export default function MealTypePanel({
  onNotify,
}: {
  onNotify: (msg: string, isError?: boolean) => void
}) {
  const [mealTypes, setMealTypes] = useState<any[]>([])
  const [children, setChildren] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [editingChild, setEditingChild] = useState<string | null>(null)
  const [pick, setPick] = useState<{ meal_type_id: string; start_date: string }>({
    meal_type_id: '', start_date: todayStr(),
  })

  /* 区分の追加 */
  const [newName, setNewName] = useState('')
  const [newIsBaby, setNewIsBaby] = useState(true)
  const [showTypeForm, setShowTypeForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/meal-types')
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { onNotify(json.error ?? '取得できませんでした', true); return }
    setMealTypes(json.mealTypes)
    setChildren(json.children)
  }, [onNotify])

  useEffect(() => { fetchData() }, [fetchData])

  const nameOf = (id?: string | null) =>
    mealTypes.find((m) => m.id === id)?.name ?? null

  const filtered = useMemo(() => {
    const k = keyword.trim()
    if (!k) return children
    return children.filter(
      (c) => c.name.includes(k) || c.login_no.includes(k) || (c.class_name ?? '').includes(k)
    )
  }, [children, keyword])

  const unsetCount = children.filter((c) => !c.meal_type_id).length

  /* ---------------- 区分の追加 ---------------- */

  const addType = async () => {
    if (!newName.trim()) { onNotify('区分の名前を入力してください。', true); return }

    const res = await fetch('/api/admin/meal-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        is_baby: newIsBaby,
        sort_order: (mealTypes.length + 1) * 10,
      }),
    })
    const json = await res.json()
    if (!res.ok) { onNotify(json.error, true); return }

    onNotify(`「${newName.trim()}」を追加しました。`)
    setNewName('')
    setShowTypeForm(false)
    fetchData()
  }

  const toggleActive = async (m: any) => {
    const res = await fetch('/api/admin/meal-types', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, is_active: !m.is_active }),
    })
    const json = await res.json()
    if (!res.ok) { onNotify(json.error, true); return }
    fetchData()
  }

  /* ---------------- 園児への割り当て ---------------- */

  const startAssign = (c: any) => {
    setEditingChild(c.id)
    setPick({ meal_type_id: c.meal_type_id ?? '', start_date: todayStr() })
  }

  const saveAssign = async (childId: string) => {
    if (!pick.meal_type_id) { onNotify('区分を選んでください。', true); return }

    const res = await fetch('/api/admin/meal-types', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child_id: childId,
        meal_type_id: pick.meal_type_id,
        start_date: pick.start_date,
      }),
    })
    const json = await res.json()
    if (!res.ok) { onNotify(json.error, true); return }

    onNotify('食事区分を設定しました。')
    setEditingChild(null)
    fetchData()
  }

  if (loading) return <p className="fa-empty">読み込んでいます…</p>

  return (
    <section>
      {unsetCount > 0 && (
        <div className="fa-warnbox" style={{ marginBottom: 18 }}>
          <p className="fa-warntitle">
            食事区分が未設定の園児が{unsetCount}名います
          </p>
          <p className="fa-warntext">
            設定すると、毎朝の食数が区分ごとに自動で集計されます。
          </p>
        </div>
      )}

      {/* 区分の一覧 */}
      <section className="fa-card" style={{ marginBottom: 18 }}>
        <div className="fa-listhead">
          <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>食事区分</h2>
          <button
            onClick={() => setShowTypeForm(!showTypeForm)}
            className="fa-filterbtn"
          >
            {showTypeForm ? '閉じる' : '+ 区分を追加'}
          </button>
        </div>

        <div className="fa-typerow">
          {mealTypes.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleActive(m)}
              className={`fa-typechip${m.is_active ? ' is-on' : ''}`}
              title={m.is_active ? 'クリックで使わない設定に' : 'クリックで使う設定に'}
            >
              {m.name}
              {m.is_baby && <span className="fa-babymark">離乳食</span>}
            </button>
          ))}
        </div>
        <p className="fa-note" style={{ marginTop: 10 }}>
          クリックすると、使う・使わないを切り替えられます。園の呼び方に合わせて追加できます。
        </p>

        {showTypeForm && (
          <div className="fa-tint fa-tint--green" style={{ marginTop: 14 }}>
            <label className="fa-label" style={{ marginTop: 0 }}>区分の名前</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例：後期食、完了食、アレルギー食 など"
              className="fa-input"
            />
            <label className="fa-filter" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={newIsBaby}
                onChange={(e) => setNewIsBaby(e.target.checked)}
              />
              離乳食の区分
            </label>
            <div className="fa-btnrow">
              <button onClick={addType} className="fa-btn fa-btn--primary">追加する</button>
            </div>
          </div>
        )}
      </section>

      {/* 園児への割り当て */}
      <div className="fa-listhead">
        <h2 className="fa-sectiontitle" style={{ marginBottom: 0 }}>園児ごとの設定</h2>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="名前・出席番号・クラスで絞り込み"
        className="fa-input"
        style={{ marginBottom: 14 }}
      />

      {filtered.length === 0 && (
        <p className="fa-empty">該当する園児がいません。</p>
      )}

      <div className="fa-grid">
        {filtered.map((c) => (
          <article key={c.id} className="fa-card">
            <p className="fa-date">
              {c.class_name ?? 'クラス未設定'}　No.{c.login_no}
            </p>
            <p className="fa-menuname">{c.name}</p>

            {editingChild === c.id ? (
              <>
                <label className="fa-label">食事区分</label>
                <select
                  value={pick.meal_type_id}
                  onChange={(e) => setPick({ ...pick, meal_type_id: e.target.value })}
                  className="fa-input"
                >
                  <option value="">選んでください</option>
                  {mealTypes.filter((m) => m.is_active).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                <label className="fa-label">いつから</label>
                <input
                  type="date"
                  value={pick.start_date}
                  onChange={(e) => setPick({ ...pick, start_date: e.target.value })}
                  className="fa-input"
                />
                <p className="fa-note" style={{ marginTop: 6 }}>
                  この日から適用されます。過去の食数は変わりません。
                </p>

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
                  {c.meal_type_id ? (
                    <span className="fa-tag fa-tag--none">{nameOf(c.meal_type_id)}</span>
                  ) : (
                    <span className="fa-tag fa-tag--unknown">未設定</span>
                  )}
                  {c.start_date && (
                    <span className="fa-tag fa-tag--plain">
                      {formatShort(c.start_date)}から
                    </span>
                  )}
                </div>
                <div className="fa-btnrow">
                  <button onClick={() => startAssign(c)} className="fa-btn fa-btn--sky">
                    {c.meal_type_id ? '区分を変える' : '区分を設定する'}
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}