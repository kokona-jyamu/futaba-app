/* components/MenuBulkPanel.tsx — 月間献立をまとめて登録する
 *
 * Excel（わんぱくランチ などから書き出したもの）を貼り付け、プレビューで確認してから登録する。
 *  - 列の並びは帳票ごとに違うので、列ごとに「何の列か」を選べる（1行目が見出しなら自動で読む）
 *  - 選んだ列の並びはこのパソコンに覚えておき、次回も使う
 *  - 主食・主菜などの列は料理として登録し、献立に付ける（セルの中の改行で1品ずつ）
 *  - 日付が空欄の行は、すぐ上の日の続きとして読む
 * アレルゲンが未記入の日は登録しない。
 */
'use client'

import { useState, useMemo } from 'react'
import { findAllergen } from '@/lib/allergens'
import { formatDate } from '@/lib/menu'
import { fetchJson } from '@/lib/useLoadEffect'
import { sortKinds, type PhotoKind } from '@/lib/menuPhotos'
import {
  BASE_FIELDS, defaultColumns, detectHeader, groupDays, parseTable,
  type ColumnField,
} from '@/lib/menuImport'
import type { DishSummary, MenusBulkResponse } from '@/lib/apiTypes'

type Props = {
  kinds: PhotoKind[]
  library: DishSummary[]
  onNotify: (msg: string, isError?: boolean) => void
  /** 登録したあと（献立と料理の一覧を取り直すため） */
  onDone: () => void
}

/** 選んだ列の並びを覚えておく場所（このパソコンのブラウザ） */
const STORAGE_KEY = 'futaba.menuBulk.columns'

const loadSavedColumns = (): ColumnField[] | null => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

const saveColumns = (columns: ColumnField[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(columns)) } catch { /* 覚えられなくても登録はできる */ }
}

export default function MenuBulkPanel({ kinds, library, onNotify, onDone }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MenusBulkResponse | null>(null)
  /** 画面で選び直した列の並び（選んでいなければ自動） */
  const [chosen, setChosen] = useState<ColumnField[] | null>(null)
  /** 1行目を見出しとして扱うか（null は自動判定） */
  const [headerChoice, setHeaderChoice] = useState<boolean | null>(null)

  const sortedKinds = useMemo(() => sortKinds(kinds), [kinds])
  const validFields = useMemo(
    () => new Set<string>([...BASE_FIELDS.map((f) => f.key), ...kinds.map((k) => `kind:${k.id}`), 'ignore']),
    [kinds]
  )

  const table = useMemo(() => parseTable(text), [text])
  const colCount = useMemo(() => Math.max(0, ...table.map((r) => r.length)), [table])
  const detected = useMemo(() => (table[0] ? detectHeader(table[0], kinds) : null), [table, kinds])
  const hasHeader = headerChoice ?? detected !== null

  const columns = useMemo<ColumnField[]>(() => {
    const fit = (c: ColumnField[] | null) =>
      c && c.length === colCount && c.every((f) => validFields.has(f)) ? c : null
    return (
      fit(chosen) ??
      (hasHeader ? fit(detected) : null) ??
      fit(loadSavedColumns()) ??
      defaultColumns(colCount, kinds)
    )
  }, [chosen, colCount, hasHeader, detected, validFields, kinds])

  const dataRows = useMemo(() => (hasHeader ? table.slice(1) : table), [table, hasHeader])
  const days = useMemo(
    () => groupDays(dataRows, columns, hasHeader ? 2 : 1),
    [dataRows, columns, hasHeader]
  )

  const valid = days.filter((r) => !r.error)
  const invalid = days.filter((r) => r.error)
  const unknownWords = useMemo(() => [...new Set(days.flatMap((r) => r.unknownAllergens))], [days])

  /* まだ登録されていない料理（登録すると新しく作られる） */
  const known = useMemo(() => new Set(library.map((d) => `${d.kind_id}\u0000${d.name}`)), [library])
  const isNew = (d: { kind_id: string; name: string }) => !known.has(`${d.kind_id}\u0000${d.name}`)
  const newDishNames = [...new Set(valid.flatMap((r) => r.dishes.filter(isNew).map((d) => d.name)))]
  const kindLabel = useMemo(() => new Map(kinds.map((k) => [k.id, k.label])), [kinds])
  const hasDishColumn = columns.some((f) => f.startsWith('kind:'))
  const hasDateColumn = columns.includes('date')

  const setColumn = (i: number, field: ColumnField) => {
    const next = columns.map((f, j) => (j === i ? field : f))
    setChosen(next)
    saveColumns(next)
  }

  const reset = () => {
    setText('')
    setChosen(null)
    setHeaderChoice(null)
  }

  const handleSubmit = async () => {
    if (valid.length === 0) {
      onNotify('登録できる日がありません。', true)
      return
    }

    setLoading(true)
    const r = await fetchJson<MenusBulkResponse>('/api/admin/menus/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: valid.map((d) => ({
          served_date: d.served_date,
          title: d.title,
          ingredients: d.ingredients,
          kcal: d.kcal, protein: d.protein, fat: d.fat,
          carb: d.carb, salt: d.salt, calcium: d.calcium,
          allergens: d.allergens ?? {},
          dishes: d.dishes,
        })),
      }),
    })
    setLoading(false)

    if (!r.ok) { onNotify(r.json.error, true); return }

    /* 次回も同じ並びで読めるように覚えておく */
    saveColumns(columns)
    setResult(r.json)
    reset()
    onNotify(`${r.json.inserted}件を下書きとして登録しました。`)
    onDone()
  }

  /* ---------------- 登録後 ---------------- */
  if (result) {
    return (
      <section className="fa-card" style={{ maxWidth: 620 }}>
        <h2 className="fa-cardtitle">登録が終わりました</h2>
        <p className="fa-note" style={{ marginTop: 10 }}>
          {result.inserted}件を下書きとして登録しました。
          {result.newDishes > 0 && `料理を${result.newDishes}品、新しく登録しました。`}
          保護者にはまだ表示されません。
          当日の朝に写真とコメントを入れて公開してください。
        </p>

        {result.skippedDates.length > 0 && (
          <div className="fa-warnbox" style={{ marginTop: 14 }}>
            <p className="fa-warntitle">すでに登録済みの日がありました</p>
            <p className="fa-warntext">
              {result.skippedDates.map((d) => formatDate(d)).join('、')}
              はすでに献立があるため、登録していません。
              変更したい場合は「編集」から行ってください。
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
          献立表の Excel で、表の範囲を選んでコピーし、そのまま貼り付けてください（見出しの行ごとでも大丈夫です）。
          貼り付けたあと、列ごとに「何の列か」を選べます。
        </p>
        <ul className="fa-note fa-bulkhints">
          <li>主食・主菜などの列は、料理として登録されます。1つのセルに2品あるときは、セルの中で改行（Alt＋Enter）してください。</li>
          <li>1日を何行かに分けて書いている表は、2行目から日付を空欄にしておけば、上の日の続きとして読みます。</li>
          <li>アレルゲンは「・」や「、」で区切り、ひとつも使っていない日は「なし」と書きます。空欄の日は登録されません。</li>
          <li>年のない日付（例：1/5）は、今日に一番近い年として読みます。</li>
        </ul>

        <label className="fa-label">月間の献立</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={'日付\t主食\t主菜\t汁物\tエネルギー\tアレルゲン\n9/1\tごはん\tさばの味噌煮\tけんちん汁\t642\t小麦・大豆・さば'}
          className="fa-input fa-textarea"
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}
        />
      </div>

      {table.length > 0 && (
        <div className="fa-card" style={{ marginBottom: 16 }}>
          <div className="fa-listhead">
            <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>列の割り当て</h2>
            <label className="fa-note fa-bulkheadcheck">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHeaderChoice(e.target.checked)}
              />
              1行目は見出し
            </label>
          </div>
          <p className="fa-note" style={{ marginTop: 6 }}>
            {hasHeader && detected && !chosen
              ? '見出しから自動で割り当てました。違うところがあれば選び直してください。'
              : '列ごとに、何の列かを選んでください。選んだ並びは次回も使います。'}
          </p>

          <div className="fa-colmap">
            {columns.map((f, i) => {
              const sample = (hasHeader ? table[0]?.[i] : dataRows[0]?.[i]) ?? ''
              return (
                <div key={i} className="fa-colmap-item">
                  <span className="fa-colmap-sample" title={sample}>
                    {i + 1}列目{sample ? `：${sample.split(/\r?\n/)[0]}` : ''}
                  </span>
                  <select
                    value={f}
                    onChange={(e) => setColumn(i, e.target.value as ColumnField)}
                    className={`fa-input fa-input--sm${f === 'ignore' ? ' is-ignored' : ''}`}
                  >
                    <option value="ignore">使わない</option>
                    <optgroup label="献立">
                      {BASE_FIELDS.map((b) => (
                        <option key={b.key} value={b.key}>{b.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="料理">
                      {sortedKinds.map((k) => (
                        <option key={k.id} value={`kind:${k.id}`}>
                          {k.label}{k.is_active ? '' : '（使っていない種類）'}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )
            })}
          </div>

          {!hasDateColumn && (
            <p className="fa-note" style={{ marginTop: 10, color: 'var(--fa-rose-ink)' }}>
              「日付」の列を選んでください。
            </p>
          )}
        </div>
      )}

      {days.length > 0 && hasDateColumn && (
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
              <p className="fa-warntitle">{invalid.length}日分は登録できません</p>
              <p className="fa-warntext">
                {invalid.slice(0, 5).map((r) => (
                  `${r.lineNo}行目（${r.title || '献立名なし'}）：${r.error}`
                )).join('　')}
                {invalid.length > 5 && ` ほか${invalid.length - 5}日`}
              </p>
            </div>
          )}

          {newDishNames.length > 0 && (
            <div className="fa-tint fa-tint--green" style={{ marginBottom: 16 }}>
              <p className="fa-label" style={{ marginTop: 0 }}>新しく登録する料理（{newDishNames.length}品）</p>
              <p className="fa-note" style={{ marginTop: 4 }}>
                {newDishNames.join('、')}
              </p>
              <p className="fa-note" style={{ marginTop: 4 }}>
                すでにある料理と名前が少し違うだけのもの（例：「みそ汁」と「味噌汁」）は別の料理になります。
                あとから「料理」タブで直せます。
              </p>
            </div>
          )}

          <div className="fa-card">
            <div className="fa-listhead">
              <h2 className="fa-cardtitle" style={{ marginBottom: 0 }}>読み取り結果</h2>
              <span className="fa-note">
                {days.length}日中 {valid.length}日が登録できます
              </span>
            </div>

            <div className="fa-bulklist">
              {days.map((r) => (
                <div
                  key={r.lineNo}
                  className={`fa-bulkrow${r.error ? ' is-error' : ''}`}
                >
                  <span className="fa-bulkdate">
                    {r.served_date ? formatDate(r.served_date) : `${r.lineNo}行目`}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="fa-bulktitle">{r.title || '（献立名なし）'}</span>
                    {r.dishes.length > 0 && (
                      <span className="fa-bulkdishes">
                        {r.dishes.map((d) => (
                          <span key={`${d.kind_id}-${d.name}`} className="fa-tag fa-tag--plain">
                            {kindLabel.get(d.kind_id)}：{d.name}{isNew(d) && '（新）'}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="fa-bulkkcal">{r.kcal ?? '—'}</span>
                  <span className="fa-bulkalg">
                    {r.error ? (
                      <span className="fa-tag fa-tag--err">{r.error}</span>
                    ) : r.allergenStatus === 'none' ? (
                      <span className="fa-tag fa-tag--none">該当なし</span>
                    ) : (
                      Object.keys(r.allergens ?? {}).map((k) => (
                        <span key={k} className="fa-tag">{findAllergen(k).label}</span>
                      ))
                    )}
                  </span>
                </div>
              ))}
            </div>

            {!hasDishColumn && (
              <p className="fa-note" style={{ marginTop: 10 }}>
                料理（主食・主菜など）の列が選ばれていないため、料理は付きません。献立名だけ登録されます。
              </p>
            )}

            <div className="fa-btnrow">
              <button
                onClick={handleSubmit}
                disabled={loading || valid.length === 0}
                className="fa-btn fa-btn--primary"
              >
                {loading ? '登録中…' : `${valid.length}日分を下書きとして登録`}
              </button>
              <button onClick={reset} className="fa-btn fa-btn--ghost">
                やり直す
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
