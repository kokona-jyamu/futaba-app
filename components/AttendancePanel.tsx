/* components/AttendancePanel.tsx — 管理画面「食数」タブ
 *
 * その日の食数を区分ごとに出す。
 * 欠席・遅刻・アレルギー除去・発熱の状況もまとめて見える。
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatShort, todayStr, hasFever, reasonLabel } from '@/lib/attendance'

type Props = {
  onNotify: (msg: string, isError?: boolean) => void
}

export default function AttendancePanel({ onNotify }: Props) {
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/attendance?date=${date}`)
    const json = await res.json()
    setLoading(false)
    if (res.ok) setData(json)
    else onNotify(json.error ?? '取得できませんでした', true)
  }, [date, onNotify])

  useEffect(() => { fetchData() }, [fetchData])

  const shiftDate = (days: number) => {
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + days)
    setDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }

  if (loading && !data) {
    return <p className="fa-empty">読み込んでいます…</p>
  }
  if (!data) return null

  const isToday = date === todayStr()
  const lunchCounts = data.counts.filter((c: any) => c.count > 0)

  return (
    <section>
      {/* 日付の切り替え */}
      <div className="fa-datebar">
        <button onClick={() => shiftDate(-1)} className="fa-cal-nav" aria-label="前の日">‹</button>
        <div className="fa-datebar-main">
          <p className="fa-datebar-day">
            {formatShort(date)}
            {isToday && <span className="fa-todaymark">今日</span>}
          </p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="fa-input fa-input--sm"
            style={{ width: 'auto', marginTop: 4 }}
          />
        </div>
        <button onClick={() => shiftDate(1)} className="fa-cal-nav" aria-label="次の日">›</button>
        {!isToday && (
          <button onClick={() => setDate(todayStr())} className="fa-filterbtn">
            今日に戻る
          </button>
        )}
      </div>

      {/* 合計 */}
      <div className="fa-totalcard">
        <div>
          <p className="fa-totallabel">用意する食数</p>
          <p className="fa-totalnum">
            {data.total}<span className="fa-totalunit">食</span>
          </p>
        </div>
        <div className="fa-totalsub">
          <p>在籍 {data.enrolled} 名</p>
          <p>欠席 {data.absent.length} 名</p>
          <p>遅刻 {data.late.length} 名</p>
        </div>
      </div>

      {/* 発熱の注意 */}
      {data.feverCount > 0 && (
        <div className="fa-warnbox" style={{ marginBottom: 16 }}>
          <p className="fa-warntitle">
            発熱の連絡が{data.feverCount}件あります
          </p>
          <p className="fa-warntext">
            37.5度以上の体温が報告されています。感染症の広がりにご注意ください。
          </p>
        </div>
      )}

      <div className="fa-cols">
        {/* 左：区分ごとの食数 */}
        <div>
          <section className="fa-card" style={{ marginBottom: 16 }}>
            <h2 className="fa-cardtitle">区分ごとの食数</h2>

            {lunchCounts.length === 0 ? (
              <p className="fa-note" style={{ marginTop: 12 }}>
                用意する食数がありません。
              </p>
            ) : (
              <div className="fa-mealcounts">
                {lunchCounts.map((c: any) => (
                  <div
                    key={c.id}
                    className={`fa-mealcount${c.id === '__unset' ? ' is-unset' : ''}`}
                  >
                    <span className="fa-mealname">{c.name}</span>
                    <span className="fa-mealnum">{c.count}</span>
                  </div>
                ))}
              </div>
            )}

            {data.counts.some((c: any) => c.id === '__unset' && c.count > 0) && (
              <p className="fa-note" style={{ marginTop: 12 }}>
                食事区分が設定されていない園児がいます。「園児」タブから設定してください。
              </p>
            )}
          </section>

          {/* アレルギー除去 */}
          <section className="fa-card">
            <h2 className="fa-cardtitle">アレルギー対応</h2>
            {data.allergyCounts.length === 0 ? (
              <p className="fa-note" style={{ marginTop: 12 }}>
                今日は除去が必要な園児はいません。
              </p>
            ) : (
              <>
                <div className="fa-tagrow" style={{ marginTop: 12 }}>
                  {data.allergyCounts.map((a: any) => (
                    <span key={a.key} className="fa-allergycount">
                      {a.emoji} {a.label}
                      <strong>{a.count}名</strong>
                    </span>
                  ))}
                </div>
                <p className="fa-note" style={{ marginTop: 10 }}>
                  登園予定の園児のうち、それぞれの食材を登録している人数です。
                </p>
              </>
            )}
          </section>
        </div>

        {/* 右：欠席・遅刻の一覧 */}
        <div>
          <section className="fa-card" style={{ marginBottom: 16 }}>
            <h2 className="fa-cardtitle">
              欠席 <span className="fa-countbadge">{data.absent.length}</span>
            </h2>
            {data.absent.length === 0 ? (
              <p className="fa-note" style={{ marginTop: 12 }}>欠席の連絡はありません。</p>
            ) : (
              <div className="fa-attlist">
                {data.absent.map((c: any) => (
                  <div key={c.id} className="fa-attrow">
                    <div style={{ minWidth: 0 }}>
                      <p className="fa-attname">
                        {c.name}
                        <span className="fa-attclass">{c.class_name ?? ''}</span>
                      </p>
                      <p className="fa-attmeta">
                        {reasonLabel(c.reason_type)}
                        {c.temperature && (
                          <span className={hasFever(c.temperature) ? 'fa-fever' : ''}>
                            　{c.temperature}度
                          </span>
                        )}
                        {c.symptoms && `　${c.symptoms}`}
                      </p>
                      {c.reason && <p className="fa-attnote">{c.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="fa-card">
            <h2 className="fa-cardtitle">
              遅刻 <span className="fa-countbadge">{data.late.length}</span>
            </h2>
            {data.late.length === 0 ? (
              <p className="fa-note" style={{ marginTop: 12 }}>遅刻の連絡はありません。</p>
            ) : (
              <div className="fa-attlist">
                {data.late.map((c: any) => (
                  <div key={c.id} className="fa-attrow">
                    <div style={{ minWidth: 0 }}>
                      <p className="fa-attname">
                        {c.name}
                        <span className="fa-attclass">{c.class_name ?? ''}</span>
                      </p>
                      <p className="fa-attmeta">
                        {c.arrival_time && `${c.arrival_time}ごろ登園`}
                        {c.reason_type && `　${reasonLabel(c.reason_type)}`}
                        {c.temperature && (
                          <span className={hasFever(c.temperature) ? 'fa-fever' : ''}>
                            　{c.temperature}度
                          </span>
                        )}
                      </p>
                      {c.reason && <p className="fa-attnote">{c.reason}</p>}
                    </div>
                    <span className={`fa-lunchmark${c.needs_lunch ? ' is-on' : ''}`}>
                      {c.needs_lunch ? '給食あり' : '給食なし'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <p className="fa-note" style={{ marginTop: 16 }}>
        連絡のない園児は出席として数えています（今日は{data.noReport.length}名）。
        締め切りは{data.deadline}です。
      </p>
    </section>
  )
}