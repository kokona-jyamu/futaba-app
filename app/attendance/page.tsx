/* app/attendance/page.tsx — 保護者の出欠連絡
 *
 * 欠席・遅刻のときだけ連絡する。連絡がなければ出席とみなす。
 * 単日でも複数日でも登録できる。
 */
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useGuardian } from '@/lib/useGuardian'
import {
  REASON_TYPES, reasonLabel, STATUS_LABEL,
  todayStr, toDateStr, dateRange, formatShort, weekdayOf, isWeekend,
  isPastDeadline, hasFever,
  type AttendanceStatus,
} from '@/lib/attendance'

type Mode = 'single' | 'range'

export default function AttendancePage() {
  const router = useRouter()
  const { loading, guardian, child, signedOut } = useGuardian()

  const [attendances, setAttendances] = useState<any[]>([])
  const [deadline, setDeadline] = useState('09:00')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [sending, setSending] = useState(false)

  /* 入力 */
  const [mode, setMode] = useState<Mode>('single')
  const [date, setDate] = useState(todayStr())
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<AttendanceStatus>('absent')
  const [arrivalTime, setArrivalTime] = useState('')
  const [needsLunch, setNeedsLunch] = useState(true)
  const [reasonType, setReasonType] = useState('sick')
  const [reason, setReason] = useState('')
  const [temperature, setTemperature] = useState('')
  const [symptoms, setSymptoms] = useState('')

  const notify = (text: string, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  useEffect(() => {
    if (signedOut) router.push('/login')
  }, [signedOut, router])

  /* ---------------- 取得 ---------------- */

  const fetchData = useCallback(async () => {
    if (!guardian) return
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)

    const res = await fetch(
      `/api/attendance?from=${toDateStr(start)}&to=${toDateStr(end)}`
    )
    const json = await res.json()
    if (res.ok) {
      setAttendances(json.attendances)
      setDeadline(json.deadline)
    }
  }, [guardian])

  useEffect(() => { fetchData() }, [fetchData])

  /* ---------------- 対象日 ---------------- */

  const rangeDates = useMemo(() => dateRange(from, to), [from, to])
  const targetDates = useMemo(() => {
    if (mode === 'single') return [date]
    return rangeDates.filter((d) => !excluded.has(d))
  }, [mode, date, rangeDates, excluded])

  const toggleExclude = (d: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  /* 期間を選び直したら、土日は既定で外しておく */
  useEffect(() => {
    if (mode !== 'range') return
    setExcluded(new Set(rangeDates.filter(isWeekend)))
  }, [mode, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const pastDeadline = targetDates.some((d) => isPastDeadline(d, deadline))

  /* ---------------- 送信 ---------------- */

  const submit = async () => {
    if (targetDates.length === 0) {
      notify('日付を選んでください。', true)
      return
    }
    if (status === 'late' && !arrivalTime) {
      notify('登園予定の時間を入れてください。', true)
      return
    }

    setSending(true)
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dates: targetDates,
        status,
        arrival_time: arrivalTime || null,
        needs_lunch: needsLunch,
        reason_type: reasonType,
        reason: reason.trim() || null,
        temperature: temperature || null,
        symptoms: symptoms.trim() || null,
      }),
    })
    const json = await res.json()
    setSending(false)

    if (!res.ok) { notify(json.error, true); return }

    notify(
      targetDates.length === 1
        ? `${formatShort(targetDates[0])}の連絡を送りました。`
        : `${targetDates.length}日分の連絡を送りました。`
    )
    setReason(''); setSymptoms(''); setTemperature(''); setArrivalTime('')
    fetchData()
  }

  const cancel = async (targetDate: string) => {
    if (!confirm(`${formatShort(targetDate)}の連絡を取り消します。出席の予定に戻ります。`)) return

    const res = await fetch('/api/attendance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dates: [targetDate] }),
    })
    const json = await res.json()
    if (!res.ok) { notify(json.error, true); return }

    notify('連絡を取り消しました。')
    fetchData()
  }

  /* ---------------- 描画 ---------------- */

  if (loading) {
    return <main className="fa-page"><p className="fa-empty">読み込んでいます…</p></main>
  }
  if (!guardian || !child) {
    return (
      <main className="fa-page">
        <p className="fa-empty">保護者としてログインしてください。</p>
      </main>
    )
  }

  const today = todayStr()
  const upcoming = attendances
    .filter((a) => a.target_date >= today)
    .sort((a, b) => a.target_date.localeCompare(b.target_date))
  const past = attendances
    .filter((a) => a.target_date < today)
    .sort((a, b) => b.target_date.localeCompare(a.target_date))

  return (
    <main className="fa-page" style={{ maxWidth: 760 }}>
      <Link href="/" className="fa-back">← 給食だよりに戻る</Link>

      <div className="fa-pagehead">
        <h1 className="fa-title">🗓 おやすみの連絡</h1>
        <p className="fa-lead">
          {child.name}さんのお休み・遅刻をお知らせできます。
          出席の日は連絡は要りません。
        </p>
      </div>

      {message && (
        <p className={`fa-toast${isError ? ' is-error' : ''}`} role="status">{message}</p>
      )}

      {/* ---------------- 入力 ---------------- */}
      <section className="fa-card" style={{ marginBottom: 20 }}>
        <h2 className="fa-cardtitle">連絡する</h2>

        {/* 単日 / 期間 */}
        <div className="fa-tabs" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 14 }}>
          <button
            className={`fa-tab${mode === 'single' ? ' is-on' : ''}`}
            onClick={() => setMode('single')}
          >
            1日だけ
          </button>
          <button
            className={`fa-tab${mode === 'range' ? ' is-on' : ''}`}
            onClick={() => setMode('range')}
          >
            何日か続けて
          </button>
        </div>

        {mode === 'single' ? (
          <>
            <label className="fa-label">日付</label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="fa-input"
            />
          </>
        ) : (
          <>
            <div className="fa-cols" style={{ gap: 12 }}>
              <div>
                <label className="fa-label">はじめの日</label>
                <input
                  type="date" value={from} min={today}
                  onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value) }}
                  className="fa-input"
                />
              </div>
              <div>
                <label className="fa-label">おわりの日</label>
                <input
                  type="date" value={to} min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="fa-input"
                />
              </div>
            </div>

            {rangeDates.length > 0 && (
              <>
                <label className="fa-label">
                  お休みする日（外したい日はタップ）
                </label>
                <div className="fa-daypicks">
                  {rangeDates.map((d) => {
                    const on = !excluded.has(d)
                    return (
                      <button
                        key={d}
                        onClick={() => toggleExclude(d)}
                        className={`fa-daypick${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                      >
                        <span className="fa-daypick-d">
                          {Number(d.slice(8, 10))}
                        </span>
                        <span className="fa-daypick-w">{weekdayOf(d)}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="fa-note" style={{ marginTop: 8 }}>
                  {targetDates.length}日分を連絡します。土日はあらかじめ外してあります。
                </p>
              </>
            )}
          </>
        )}

        {/* 区分 */}
        <label className="fa-label">どうされますか</label>
        <div className="fa-statusrow">
          {(['absent', 'late'] as AttendanceStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`fa-statusbtn${status === s ? ' is-on' : ''}`}
              aria-pressed={status === s}
            >
              {s === 'absent' ? '🏠 おやすみ' : '🕐 遅れて登園'}
            </button>
          ))}
        </div>

        {status === 'late' && (
          <>
            <label className="fa-label">登園する時間のめやす</label>
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="fa-input"
              style={{ maxWidth: 200 }}
            />

            <label className="fa-label">給食</label>
            <div className="fa-statusrow">
              <button
                onClick={() => setNeedsLunch(true)}
                className={`fa-statusbtn${needsLunch ? ' is-on' : ''}`}
              >
                食べます
              </button>
              <button
                onClick={() => setNeedsLunch(false)}
                className={`fa-statusbtn${!needsLunch ? ' is-on' : ''}`}
              >
                いりません
              </button>
            </div>
            <p className="fa-note" style={{ marginTop: 6 }}>
              給食の準備数に反映されます。
            </p>
          </>
        )}

        {/* 理由 */}
        <label className="fa-label">理由</label>
        <div className="fa-statusrow">
          {REASON_TYPES.map((r) => (
            <button
              key={r.key}
              onClick={() => setReasonType(r.key)}
              className={`fa-statusbtn fa-statusbtn--sm${reasonType === r.key ? ' is-on' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {reasonType === 'sick' && (
          <div className="fa-tint fa-tint--apricot" style={{ marginTop: 14 }}>
            <p className="fa-note" style={{ marginBottom: 10 }}>
              差し支えなければ、体温と症状もお知らせください。
              園での感染症の広がりを防ぐために役立ちます。
            </p>

            <label className="fa-label" style={{ marginTop: 0 }}>体温</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" step="0.1" min="33" max="43" inputMode="decimal"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="37.5"
                className="fa-input"
                style={{ maxWidth: 120 }}
              />
              <span className="fa-note">度</span>
            </div>

            <label className="fa-label">症状</label>
            <input
              type="text"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="せき、鼻水 など"
              className="fa-input"
            />
          </div>
        )}

        <label className="fa-label">園に伝えたいこと</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="ほかに伝えたいことがあれば"
          className="fa-input fa-textarea"
        />

        {pastDeadline && (
          <p className="fa-toast is-error" style={{ marginTop: 14, marginBottom: 0 }}>
            本日の締め切り（{deadline}）を過ぎています。
            給食の準備が済んでいる場合があるため、園にもお電話ください。
          </p>
        )}

        <div className="fa-actions" style={{ display: 'block' }}>
          <button
            onClick={submit}
            disabled={sending || targetDates.length === 0}
            className="fa-btn fa-btn--primary"
            style={{ width: '100%' }}
          >
            {sending ? '送信中…' : `連絡する（${targetDates.length}日分）`}
          </button>
        </div>
      </section>

      {/* ---------------- これからの予定 ---------------- */}
      {upcoming.length > 0 && (
        <>
          <h2 className="fa-subtitle">連絡ずみ</h2>
          <div className="fa-grid fa-grid--2">
            {upcoming.map((a) => (
              <article key={a.id} className="fa-card">
                <p className="fa-date">{formatShort(a.target_date)}</p>
                <p className="fa-menuname">
                  {STATUS_LABEL[a.status as AttendanceStatus]}
                  {a.status === 'late' && a.arrival_time && `（${a.arrival_time}ごろ）`}
                </p>
                <div className="fa-tagrow">
                  {a.reason_type && (
                    <span className="fa-tag fa-tag--plain">{reasonLabel(a.reason_type)}</span>
                  )}
                  {a.temperature && (
                    <span className={`fa-tag${hasFever(a.temperature) ? ' fa-tag--err' : ' fa-tag--plain'}`}>
                      {a.temperature}度
                    </span>
                  )}
                  {a.status === 'late' && (
                    <span className={`fa-tag ${a.needs_lunch ? 'fa-tag--none' : 'fa-tag--plain'}`}>
                      {a.needs_lunch ? '給食あり' : '給食なし'}
                    </span>
                  )}
                </div>
                {a.reason && <p className="fa-note" style={{ marginTop: 8 }}>{a.reason}</p>}
                <div className="fa-btnrow">
                  <button onClick={() => cancel(a.target_date)} className="fa-btn fa-btn--ghost">
                    取り消す
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* ---------------- これまでの記録 ---------------- */}
      {past.length > 0 && (
        <>
          <h2 className="fa-subtitle">これまでのおやすみ</h2>
          <div className="fa-card">
            <div className="fa-attlist">
              {past.map((a) => (
                <div key={a.id} className="fa-attrow">
                  <div style={{ minWidth: 0 }}>
                    <p className="fa-attname">
                      {formatShort(a.target_date)}
                      <span className="fa-attclass">
                        {STATUS_LABEL[a.status as AttendanceStatus]}
                      </span>
                    </p>
                    <p className="fa-attmeta">
                      {reasonLabel(a.reason_type)}
                      {a.temperature && (
                        <span className={hasFever(a.temperature) ? 'fa-fever' : ''}>
                          　{a.temperature}度
                        </span>
                      )}
                      {a.symptoms && `　${a.symptoms}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="fa-note" style={{ marginTop: 12 }}>
              体調の記録は、かかりつけ医にかかるときの参考にもなります。
            </p>
          </div>
        </>
      )}
    </main>
  )
}