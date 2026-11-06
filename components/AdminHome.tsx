/* components/AdminHome.tsx — 管理画面のホーム（開いたときに最初に出す画面）
 *
 *  - 今日の献立（未登録・下書き・公開済み）と今日の食数
 *  - やること（件数つき）。押すとその画面へ移る
 *  - メニュー（各画面への入口）
 * 献立・質問・アレルギーの件数は親（管理画面）が読んだものを受け取り、
 * 食数と食育だけここで読む。
 */
'use client'

import { useState, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import { useLoadEffect, fetchJson } from '@/lib/useLoadEffect'
import { todayStr, addDays, weekdayIndex } from '@/lib/date'
import { formatDate } from '@/lib/menu'
import { phaseOf } from '@/lib/eventStatus'
import type { AdminMenu, AttendanceSummary, EventsResponse } from '@/lib/apiTypes'

export type AdminTab =
  | 'home' | 'meals' | 'post' | 'bulk' | 'edit' | 'print' | 'dishes'
  | 'events' | 'messages' | 'children' | 'settings'

type Props = {
  menus: AdminMenu[]
  openQuestions: number
  allergyPending: number
  uncheckedMenus: number
  /** 今日の下書きの公開欄（今日の献立が下書きのときに出す） */
  todayDraft: ReactNode
  onGo: (tab: AdminTab, opts?: { filter?: 'unchecked' }) => void
}

/** 献立が未登録か調べる先（今日から何日先まで） */
const LOOKAHEAD_DAYS = 14

const MENU_ITEMS: { tab: AdminTab; label: string; sub: string }[] = [
  { tab: 'meals', label: '食数', sub: '今日の食数・欠席・アレルギー対応' },
  { tab: 'post', label: '1日ずつ', sub: '1日分の献立を登録する' },
  { tab: 'bulk', label: '月間登録', sub: 'Excel からまとめて登録する' },
  { tab: 'edit', label: '編集', sub: '登録した献立を直す・公開する' },
  { tab: 'print', label: '献立表', sub: '配る・貼る献立表を印刷する' },
  { tab: 'dishes', label: '料理', sub: '料理とレシピの一覧' },
  { tab: 'events', label: '食育', sub: '食育の予告と記録・写真・動画' },
  { tab: 'messages', label: '質問', sub: '保護者からの質問に返信する' },
  { tab: 'children', label: '園児', sub: '園児・保護者・アレルギー・PIN' },
  { tab: 'settings', label: '設定', sub: '写真の種類・アレルギーの扱い など' },
]

const requestAttendance = () =>
  fetchJson<AttendanceSummary>(`/api/admin/attendance?date=${todayStr()}`)
const requestEvents = () => fetchJson<EventsResponse>('/api/admin/events')

export default function AdminHome({
  menus, openQuestions, allergyPending, uncheckedMenus, todayDraft, onGo,
}: Props) {
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null)
  const [needsRecord, setNeedsRecord] = useState(0)

  useLoadEffect(requestAttendance, (r) => { if (r.ok) setAttendance(r.json) })
  useLoadEffect(requestEvents, (r) => {
    if (r.ok) {
      setNeedsRecord(r.json.events.filter((e) => phaseOf(e.event_date) === 'past' && !e.photo_view_url).length)
    }
  })

  const today = todayStr()
  const todayMenu = menus.find((m) => m.served_date === today)

  /* これから2週間の平日で、献立がまだない日 */
  const registered = new Set(menus.map((m) => m.served_date))
  const missingDays = Array.from({ length: LOOKAHEAD_DAYS }, (_, i) => addDays(today, i + 1))
    .filter((d) => { const w = weekdayIndex(d); return w !== 0 && w !== 6 })
    .filter((d) => !registered.has(d))

  const todos: { label: string; count: number; onClick: () => void }[] = [
    { label: '返信がまだの質問', count: openQuestions, onClick: () => onGo('messages') },
    { label: '保護者が変更したアレルギー（未確認）', count: allergyPending, onClick: () => onGo('children') },
    { label: 'アレルギー情報が未確認の献立', count: uncheckedMenus, onClick: () => onGo('edit', { filter: 'unchecked' }) },
    { label: '記録（写真）がまだの食育', count: needsRecord, onClick: () => onGo('events') },
  ].filter((t) => t.count > 0)

  return (
    <section>
      <p className="fa-homedate">{formatDate(today)}</p>

      {/* ---------------- 今日 ---------------- */}
      <div className="fa-homegrid">
        <div className="fa-card">
          <h2 className="fa-cardtitle">今日の献立</h2>
          {!todayMenu ? (
            <>
              <p className="fa-note" style={{ marginTop: 8 }}>まだ登録されていません。</p>
              <div className="fa-btnrow">
                <button onClick={() => onGo('post')} className="fa-btn fa-btn--primary">1日ずつで登録する</button>
              </div>
            </>
          ) : (
            <>
              <p className="fa-menuname" style={{ marginTop: 8 }}>{todayMenu.title}</p>
              <div className="fa-tagrow">
                {todayMenu.is_published
                  ? <span className="fa-tag fa-tag--none">公開済み</span>
                  : <span className="fa-tag fa-tag--unknown">下書き（保護者にはまだ見えません）</span>}
              </div>
              {todayMenu.is_published && (
                <div className="fa-btnrow">
                  <button onClick={() => onGo('edit')} className="fa-filterbtn">編集で見る</button>
                </div>
              )}
            </>
          )}
        </div>

        <button type="button" onClick={() => onGo('meals')} className="fa-card fa-homecount">
          <span className="fa-cardtitle">今日の食数</span>
          {attendance ? (
            <>
              <span className="fa-homecount-num">{attendance.total}<small>食</small></span>
              <span className="fa-note">
                在籍{attendance.enrolled}名・欠席{attendance.absent.length}名
                {attendance.noReport.length > 0 && `・連絡なし${attendance.noReport.length}名`}
              </span>
            </>
          ) : (
            <span className="fa-note">読み込んでいます…</span>
          )}
          <span className="fa-homecount-more">食数を見る <Icon name="chevron_right" size={16} /></span>
        </button>
      </div>

      {/* 今日の献立が下書きなら、ここで写真を入れて公開できる */}
      {todayDraft}

      {/* ---------------- やること ---------------- */}
      <h2 className="fa-sectiontitle" style={{ marginTop: 24 }}>やること</h2>
      {todos.length === 0 && missingDays.length === 0 ? (
        <p className="fa-note">いま残っていることはありません。</p>
      ) : (
        <div className="fa-todolist">
          {todos.map((t) => (
            <button key={t.label} type="button" onClick={t.onClick} className="fa-todo">
              <span className="fa-todo-label">{t.label}</span>
              <span className="fa-countbadge">{t.count}件</span>
              <Icon name="chevron_right" size={18} className="fa-todo-arrow" />
            </button>
          ))}
          {missingDays.length > 0 && (
            <button type="button" onClick={() => onGo('bulk')} className="fa-todo">
              <span className="fa-todo-label">
                献立がまだの日（2週間以内の平日）
                <span className="fa-todo-sub">
                  {missingDays.slice(0, 5).map((d) => formatDate(d)).join('、')}
                  {missingDays.length > 5 && ` ほか${missingDays.length - 5}日`}
                </span>
              </span>
              <span className="fa-countbadge">{missingDays.length}日</span>
              <Icon name="chevron_right" size={18} className="fa-todo-arrow" />
            </button>
          )}
        </div>
      )}

      {/* ---------------- メニュー ---------------- */}
      <h2 className="fa-sectiontitle" style={{ marginTop: 24 }}>メニュー</h2>
      <div className="fa-homemenu">
        {MENU_ITEMS.map((m) => (
          <button key={m.tab} type="button" onClick={() => onGo(m.tab)} className="fa-homemenu-item">
            <span className="fa-homemenu-label">
              {m.label}
              {m.tab === 'messages' && openQuestions > 0 && <span className="fa-badge">{openQuestions}</span>}
              {m.tab === 'children' && allergyPending > 0 && <span className="fa-badge">{allergyPending}</span>}
            </span>
            <span className="fa-homemenu-sub">{m.sub}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
