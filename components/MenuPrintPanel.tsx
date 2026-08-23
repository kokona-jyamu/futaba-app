/* components/MenuPrintPanel.tsx — 月間献立表を印刷・PDF出力する
 *
 * ブラウザの印刷機能を使う。ダイアログで「PDFに保存」を選べば PDF になる。
 * A4縦・日付順のリスト形式。
 */
'use client'

import { useState, useMemo } from 'react'
import { formatIngredients } from '@/lib/menu'
import { usedAllergens } from '@/lib/allergens'

type Props = { menus: any[] }

const MONTHS_BACK = 3

export default function MenuPrintPanel({ menus }: Props) {
  const now = new Date()
  const [ym, setYm] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [showDraft, setShowDraft] = useState(true)
  const [showNutrition, setShowNutrition] = useState(true)
  const [showIngredients, setShowIngredients] = useState(false)

  /* 選べる月：今月の前後3か月ぶん */
  const months = useMemo(() => {
    const list: { value: string; label: string }[] = []
    for (let i = -MONTHS_BACK; i <= MONTHS_BACK; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      list.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      })
    }
    return list
  }, [now])

  const target = useMemo(() => {
    return menus
      .filter((m) => m.served_date?.startsWith(ym))
      .filter((m) => showDraft || m.is_published)
      .sort((a, b) => a.served_date.localeCompare(b.served_date))
  }, [menus, ym, showDraft])

  const label = months.find((m) => m.value === ym)?.label ?? ym

  const dayOf = (d: string) => {
    const date = new Date(`${d}T00:00:00`)
    return {
      day: date.getDate(),
      wd: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()],
      isSun: date.getDay() === 0,
      isSat: date.getDay() === 6,
    }
  }

  return (
    <section>
      {/* ---------- 設定（印刷時は消える） ---------- */}
      <div className="fa-card fa-noprint" style={{ marginBottom: 18 }}>
        <h2 className="fa-cardtitle">献立表を印刷する</h2>
        <p className="fa-note" style={{ marginTop: 8 }}>
          印刷ダイアログで「PDFに保存」を選ぶと、PDFとして保存できます。
          A4縦・日付順で出力されます。
        </p>

        <label className="fa-label">対象の月</label>
        <select
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          className="fa-input"
          style={{ maxWidth: 220 }}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <label className="fa-label">載せる内容</label>
        <div className="fa-checkrow">
          <label className="fa-filter">
            <input type="checkbox" checked={showNutrition}
              onChange={(e) => setShowNutrition(e.target.checked)} />
            栄養価6項目
          </label>
          <label className="fa-filter">
            <input type="checkbox" checked={showIngredients}
              onChange={(e) => setShowIngredients(e.target.checked)} />
            主な食材
          </label>
          <label className="fa-filter">
            <input type="checkbox" checked={showDraft}
              onChange={(e) => setShowDraft(e.target.checked)} />
            下書きも含める
          </label>
        </div>

        <div className="fa-btnrow">
          <button
            onClick={() => window.print()}
            disabled={target.length === 0}
            className="fa-btn fa-btn--primary"
          >
            印刷・PDF保存（{target.length}日分）
          </button>
        </div>

        {target.length === 0 && (
          <p className="fa-note" style={{ marginTop: 10 }}>
            {label}の献立はまだ登録されていません。
          </p>
        )}
      </div>

      {/* ---------- 印刷される部分 ---------- */}
      {target.length > 0 && (
        <div className="fa-sheet">
          <header className="fa-sheethead">
            <div>
              <p className="fa-sheetbrand">🌱 ふたば保育園</p>
              <h1 className="fa-sheettitle">{label}　給食こんだて表</h1>
            </div>
            <p className="fa-sheetnote">
              ※ アレルギー表示は特定原材料等にもとづく目安です。<br />
              　 詳しくは園までお問い合わせください。
            </p>
          </header>

          <table className="fa-sheettable">
            <thead>
              <tr>
                <th className="fa-col-day">日</th>
                <th className="fa-col-menu">こんだて</th>
                {showNutrition && (
                  <>
                    <th className="fa-col-n">kcal</th>
                    <th className="fa-col-n">P</th>
                    <th className="fa-col-n">F</th>
                    <th className="fa-col-n">C</th>
                    <th className="fa-col-n">塩</th>
                    <th className="fa-col-n">Ca</th>
                  </>
                )}
                <th className="fa-col-alg">アレルゲン</th>
              </tr>
            </thead>
            <tbody>
              {target.map((m) => {
                const d = dayOf(m.served_date)
                const used = usedAllergens(m.allergens)
                return (
                  <tr key={m.id} className={d.isSun ? 'is-sun' : d.isSat ? 'is-sat' : ''}>
                    <td className="fa-col-day">
                      <span className="fa-sheetday">{d.day}</span>
                      <span className="fa-sheetwd">{d.wd}</span>
                    </td>
                    <td className="fa-col-menu">
                      <span className="fa-sheetmenu">{m.title}</span>
                      {!m.is_published && <span className="fa-sheetdraft">下書き</span>}
                      {showIngredients && m.ingredients && (
                        <span className="fa-sheeting">{formatIngredients(m.ingredients)}</span>
                      )}
                    </td>
                    {showNutrition && (
                      <>
                        <td className="fa-col-n">{m.kcal ?? '—'}</td>
                        <td className="fa-col-n">{m.protein ?? '—'}</td>
                        <td className="fa-col-n">{m.fat ?? '—'}</td>
                        <td className="fa-col-n">{m.carb ?? '—'}</td>
                        <td className="fa-col-n">{m.salt ?? '—'}</td>
                        <td className="fa-col-n">{m.calcium ?? '—'}</td>
                      </>
                    )}
                    <td className="fa-col-alg">
                      {!m.allergen_checked
                        ? <span className="fa-sheetunknown">未確認</span>
                        : used.length === 0
                          ? <span className="fa-sheetnone">なし</span>
                          : used.map((a) => a.label).join('・')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {showNutrition && (
            <p className="fa-sheetlegend">
              P＝たんぱく質(g)　F＝脂質(g)　C＝炭水化物(g)　塩＝食塩相当量(g)　Ca＝カルシウム(mg)
            </p>
          )}
        </div>
      )}
    </section>
  )
}