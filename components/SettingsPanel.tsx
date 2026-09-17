/* components/SettingsPanel.tsx — 園の設定
 *
 * アレルギー表示の呼び方、食数への出し方、出欠の締め切りを設定する。
 * 園ごとに運用が違うので、そこを吸収する。
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { STANDARD_ALLERGENS, findAllergen } from '@/lib/allergens'

const LABEL_PRESETS = [
  { value: '{name}除去', sample: '卵除去' },
  { value: '{name}ぬき', sample: '卵ぬき' },
  { value: '{name}の代替食', sample: '卵の代替食' },
  { value: '{name}なし', sample: '卵なし' },
]

export default function SettingsPanel({
  onNotify,
}: {
  onNotify: (msg: string, isError?: boolean) => void
}) {
  const [settings, setSettings] = useState<any>(null)
  const [enrolled, setEnrolled] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/settings')
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { onNotify(json.error ?? '取得できませんでした', true); return }
    setSettings(json.settings)
    setEnrolled(json.enrolledAllergens)
  }, [onNotify])

  useEffect(() => { fetchData() }, [fetchData])

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { onNotify(json.error, true); return }
    onNotify('設定を保存しました。')
    setSettings((s: any) => ({ ...s, ...patch }))
  }

  if (loading) return <p className="fa-empty">読み込んでいます…</p>
  if (!settings) return null

  const free: Record<string, boolean> = settings.common_free_allergens ?? {}
  const freeCount = Object.values(free).filter(Boolean).length

  const toggleFree = (key: string) => {
    const next = { ...free, [key]: !free[key] }
    if (!next[key]) delete next[key]
    save({ common_free_allergens: next })
  }

  const selectAll = () => {
    const next: Record<string, boolean> = {}
    STANDARD_ALLERGENS.filter((a) => a.required).forEach((a) => { next[a.key] = true })
    save({ common_free_allergens: next })
  }

  return (
    <section>
      {/* 在籍している子のアレルギー */}
      <section className="fa-card" style={{ marginBottom: 18 }}>
        <h2 className="fa-cardtitle">いま在籍している子のアレルギー</h2>
        <p className="fa-note" style={{ marginTop: 6 }}>
          献立を組むときの参考にしてください。園児タブで登録した内容が反映されます。
        </p>

        {enrolled.length === 0 ? (
          <p className="fa-note" style={{ marginTop: 12 }}>
            アレルギーの登録がある園児はいません。
          </p>
        ) : (
          <div className="fa-attlist">
            {enrolled.map((e) => {
              const a = findAllergen(e.key)
              return (
                <div key={e.key} className="fa-attrow">
                  <div className="fa-childline">
                    <span className="fa-childline-name">{a.emoji} {a.label}</span>
                    <span className="fa-childline-class">
                      {e.children.map((c: any) => c.name).join('、')}
                    </span>
                  </div>
                  <span className="fa-countbadge">{e.count}名</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* アレルギーの扱い */}
      <section className="fa-card" style={{ marginBottom: 18 }}>
        <h2 className="fa-cardtitle">アレルギーの扱い</h2>

        <label className="fa-label">食数に個別の除去食を出す</label>
        <div className="fa-statusrow">
          <button
            onClick={() => save({ show_allergy_in_counts: true })}
            className={`fa-statusbtn${settings.show_allergy_in_counts ? ' is-on' : ''}`}
            disabled={saving}
          >
            出す
          </button>
          <button
            onClick={() => save({ show_allergy_in_counts: false })}
            className={`fa-statusbtn${!settings.show_allergy_in_counts ? ' is-on' : ''}`}
            disabled={saving}
          >
            出さない
          </button>
        </div>
        <p className="fa-note" style={{ marginTop: 8 }}>
          個別に除去食を作る園は「出す」を選んでください。
          アレルゲンを全員分の献立から外している園は「出さない」で構いません。
        </p>

        {settings.show_allergy_in_counts && (
          <>
            <label className="fa-label">呼び方</label>
            <div className="fa-statusrow">
              {LABEL_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => save({ allergy_label_format: p.value })}
                  className={`fa-statusbtn fa-statusbtn--sm${settings.allergy_label_format === p.value ? ' is-on' : ''}`}
                  disabled={saving}
                >
                  {p.sample}
                </button>
              ))}
            </div>

            <div className="fa-tint fa-tint--green" style={{ marginTop: 16 }}>
              <div className="fa-listhead">
                <h3 className="fa-tinttitle" style={{ marginBottom: 0 }}>
                  全員分から外している食材
                </h3>
                {freeCount === 0 && (
                  <button onClick={selectAll} className="fa-filterbtn" disabled={saving}>
                    表示義務8品目を選ぶ
                  </button>
                )}
              </div>
              <p className="fa-note" style={{ marginBottom: 10 }}>
                ここで選んだ食材は、はじめから使わない前提として食数に出しません。
                個別に対応している食材だけが「◯◯除去 1食」と並びます。
              </p>
              <div className="fa-chips">
                {STANDARD_ALLERGENS.map((a) => {
                  const on = free[a.key] === true
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => toggleFree(a.key)}
                      className={`fa-chip${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      disabled={saving}
                    >
                      <span className="fa-chip-emoji">{a.emoji}</span>
                      <span className="fa-chip-label">{a.label}</span>
                    </button>
                  )
                })}
              </div>
              {freeCount > 0 && (
                <p className="fa-note" style={{ marginTop: 10 }}>
                  {freeCount}品目を全員分から外しています。
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* 出欠の締め切り */}
      <section className="fa-card">
        <h2 className="fa-cardtitle">出欠連絡の締め切り</h2>
        <p className="fa-note" style={{ marginTop: 6 }}>
          この時刻を過ぎた当日の連絡には、保護者の画面で注意が出ます。
        </p>
        <label className="fa-label">締め切り時刻</label>
        <input
          type="time"
          value={settings.attendance_deadline}
          onChange={(e) => setSettings({ ...settings, attendance_deadline: e.target.value })}
          onBlur={(e) => save({ attendance_deadline: e.target.value })}
          className="fa-input"
          style={{ maxWidth: 160 }}
        />
      </section>
    </section>
  )
}