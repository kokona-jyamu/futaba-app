/* components/MenuBulkPanel.tsx — 月間献立をまとめて登録する
 *
 * Excel から貼り付けた行を解析し、プレビューで確認してから登録する。
 * アレルゲンが未記入の行は登録しない。
 */
'use client'

import { useState, useMemo } from 'react'
import { parseAllergenText, parseDate } from '@/lib/allergenAlias'
import { findAllergen } from '@/lib/allergens'
import { formatDate } from '@/lib/menu'

type ParsedRow = {
  lineNo: number
  served_date: string | null
  title: string
  ingredients: string[] | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carb: number | null
  salt: number | null
  calcium: number | null
  allergens: Record<string, boolean> | null
  allergenStatus: 'none' | 'listed' | 'empty'
  unknownAllergens: string[]
  error: string | null
}

const toNum = (s?: string) => {
  const v = Number.parseFloat((s ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(v) ? v : null
}

export default function MenuBulkPanel({
  onNotify,
  onDone,
}: {
  onNotify: (msg: string, isError?: boolean) => void
  onDone: () => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ inserted: number; skippedDates: string[] } | null>(null)

  const rows = useMemo<ParsedRow[]>(() => {
    return text
      .split('\n')
      .map((line, i) => ({ line: line.trim(), i }))
      .filter(({ line }) => line)
      .map(({ line, i }) => {
        const cols = line.includes('\t') ? line.split('\t') : line.split(',')
        const served_date = parseDate(cols[0] ?? '')
        const title = (cols[1] ?? '').trim()
        const ing = (cols[2] ?? '').trim()
        const parsed = parseAllergenText(cols[9] ?? '')

        let error: string | null = null
        if (!served_date) error = '日付が読み取れません'
        else if (!title) error = '献立名がありません'
        else if (parsed.status === 'empty') error = 'アレルゲンが未記入です'

        return {
          lineNo: i + 1,
          served_date,
          title,
          ingredients: ing
            ? ing.split(/[・,、\/]+/).map((s) => s.trim()).filter(Boolean)
            : null,
          kcal: toNum(cols[3]),
          protein: toNum(cols[4]),
          fat: toNum(cols[5]),
          carb: toNum(cols[6]),
          salt: toNum(cols[7]),
          calcium: toNum(cols[8]),
          allergens: parsed.allergens,
          allergenStatus: parsed.status,
          unknownAllergens: parsed.unknown,
          error,
        }
      })
  }, [text])

  const valid = rows.filter((r) => !r.error)
  const invalid = rows.filter((r) => r.error)
  const unknownWords = useMemo(
    () => [...new Set(rows.flatMap((r) => r.unknownAllergens))],
    [rows]
  )

  const handleSubmit = async () => {
    if (valid.length === 0) {
      onNotify('登録できる行がありません。', true)
      return
    }

    setLoading(true)
    const res = await fetch('/api/admin/menus/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: valid.map((r) => ({
          served_date: r.served_date,
          title: r.title,
          ingredients: r.ingredients,
          kcal: r.kcal, protein: r.protein, fat: r.fat,
          carb: r.carb, salt: r.salt, calcium: r.calcium,
          allergens: r.allergens ?? {},
        })),
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { onNotify(json.error, true); return }

    setResult({ inserted: json.inserted, skippedDates: json.skippedDates ?? [] })
    setText('')
    onNotify(`${json.inserted}件を下書きとして登録しました。`)
    onDone()
  }

  /* ---------------- 登録後 ---------------- */
  if (result) {
    return (
      <section className="fa-card" style={{ maxWidth: 620 }}>
        <h2 className="fa-cardtitle">登録が終わりました</h2>
        <p className="fa-note" style={{ marginTop: 10 }}>
          {result.inserted}件を下書きとして登録しました。
          保護者にはまだ表示されません。
          当日の朝に写真とコメントを入れて公開してください。
        </p>

        {result.skippedDates.length > 0 && (
          <div className="fa-warnbox" style={{ marginTop: 14 }}>
            <p className="fa-warntitle">すでに登録済みの日がありました</p>
            <p className="fa-warntext">
              {result.skippedDates.map((d) => formatDate(d)).join('、')}
              はすでに献立があるため、登録していません。
              変更したい場合は「献立を編集」から行ってください。
            </p>
          </div>
        )}

        <div className="fa-actions" style={{ display: 'block' }}>
          <button
            onClick={() => setResult(null)}
            className="fa-btn fa-btn--ghost"
            style={{ width: '100%' }}
          >
            続けて登録する
          </button>
        </div>
      </section>
    )
  }

  /* ---------------- 入力 ---------------- */
  return (
    <section>
      <div className="fa-card" style={{ marginBottom: 16 }}>
        <h2 className="fa-cardtitle">Excelから貼り付ける</h2>
        <p className="fa-note" style={{ marginTop: 8 }}>
          献立表から下の順に列を選んでコピーし、貼り付けてください。
          アレルゲンは「・」で区切り、ひとつも使っていない日は「なし」と書きます。
          空欄のままだとその行は登録されません。
        </p>

        <pre className="fa-sample" style={{ marginTop: 12 }}>{`日付 / 献立名 / 主な食材 / エネルギー / たんぱく質 / 脂質 / 炭水化物 / 食塩 / カルシウム / アレルゲン`}</pre>

        <label className="fa-label">月間の献立</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={'2026-09-01\tさばの味噌煮定食\tさば・みそ\t642\t26.1\t18.9\t88.4\t2.1\t318\t卵・乳・小麦'}
          className="fa-input fa-textarea"
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}
        />
      </div>

      {rows.length > 0 && (
        <>
          {unknownWords.length > 0 && (
            <div className="fa-warnbox" style={{ marginBottom: 16 }}>
              <p className="fa-warntitle">読み取れなかったアレルゲンがあります</p>
              <p className="fa-warntext">
                「{unknownWords.join('」「')}」は登録されている品目に該当しませんでした。
                この語は無視されます。表記を確認するか、そのまま進めてください。
              </p>
            </div>
          )}

          {invalid.length > 0 && (
            <div className="fa-warnbox" style={{ marginBottom: 16 }}>
              <p className="fa-warntitle">
                {invalid.length}行は登録できません
              </p>
              <p className="fa-warntext">
                {invalid.slice(0, 5).map((r) => (
                  `${r.lineNo}行目（${r.title || '献立名なし'}）：${r.error}`
                )).join('　')}
                {invalid.length > 5 && ` ほか${invalid.length - 5}行`}
              </p>
            </div>
          )}

          <div className="fa-card">
            <div className="fa-listhead">
              <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>読み取り結果</h2>
              <span className="fa-note">
                {rows.length}件中 {valid.length}件が登録できます
              </span>
            </div>

            <div className="fa-bulklist">
              {rows.map((r) => (
                <div
                  key={r.lineNo}
                  className={`fa-bulkrow${r.error ? ' is-error' : ''}`}
                >
                  <span className="fa-bulkdate">
                    {r.served_date ? formatDate(r.served_date) : `${r.lineNo}行目`}
                  </span>
                  <span className="fa-bulktitle">{r.title || '（献立名なし）'}</span>
                  <span className="fa-bulkkcal">{r.kcal ?? '—'}</span>
                  <span className="fa-bulkalg">
                    {r.error ? (
                      <span className="fa-tag fa-tag--err">{r.error}</span>
                    ) : r.allergenStatus === 'none' ? (
                      <span className="fa-tag fa-tag--none">✓ 該当なし</span>
                    ) : (
                      Object.keys(r.allergens ?? {}).map((k) => {
                        const a = findAllergen(k)
                        return (
                          <span key={k} className="fa-tag">{a.emoji} {a.label}</span>
                        )
                      })
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="fa-btnrow">
              <button
                onClick={handleSubmit}
                disabled={loading || valid.length === 0}
                className="fa-btn fa-btn--primary"
              >
                {loading ? '登録中…' : `${valid.length}件を下書きとして登録`}
              </button>
              <button
                onClick={() => setText('')}
                className="fa-btn fa-btn--ghost"
              >
                やり直す
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}