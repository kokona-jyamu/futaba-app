/* components/PasskeySettings.tsx — 生体認証（指紋・顔認証）の登録と管理（保護者のマイページ）
 *
 * この端末を登録すると、次から出席番号とPINを入れずに指紋・顔でログインできる。
 * 指紋・顔の情報はスマホの中だけにあり、サーバーには端末の公開鍵しか送らない。
 * 園でPINを再発行すると、登録はすべて解除される。
 */
'use client'

import { useState } from 'react'
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { useLoadEffect, fetchJson } from '@/lib/useLoadEffect'
import type { PasskeysResponse, PasskeyItem } from '@/lib/apiTypes'

/** 一覧に出す端末の名前を、ブラウザの情報からおおまかに決める */
const guessDeviceName = (): string => {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'この端末'
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })

/** 一覧を読む（この端末が生体認証に対応しているかも一緒に調べる） */
const request = async () => ({
  supported: browserSupportsWebAuthn(),
  list: await fetchJson<PasskeysResponse>('/api/passkeys'),
})

export default function PasskeySettings({
  onNotify,
}: {
  onNotify: (msg: string, isError?: boolean) => void
}) {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [supported, setSupported] = useState(true)
  const [busy, setBusy] = useState(false)

  const apply = (r: Awaited<ReturnType<typeof request>>) => {
    setSupported(r.supported)
    if (r.list.ok) setPasskeys(r.list.json.passkeys)
  }
  useLoadEffect(request, apply)
  const reload = () => request().then(apply)

  const register = async () => {
    setBusy(true)
    try {
      const opt = await fetchJson<Parameters<typeof startRegistration>[0]['optionsJSON']>(
        '/api/passkeys/register/options',
        { method: 'POST' }
      )
      if (!opt.ok) { onNotify(opt.json.error, true); return }

      /* ここでスマホの指紋・顔認証の画面が出る */
      const response = await startRegistration({ optionsJSON: opt.json })

      const r = await fetchJson<{ ok: true }>('/api/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, device_name: guessDeviceName() }),
      })
      if (!r.ok) { onNotify(r.json.error, true); return }

      onNotify('この端末を登録しました。次からは「指紋・顔認証でログイン」でログインできます。')
      reload()
    } catch (e) {
      /* 途中でやめた場合や、すでに登録済みの端末の場合 */
      const name = (e as { name?: string })?.name
      onNotify(
        name === 'InvalidStateError'
          ? 'この端末はすでに登録されています。'
          : '登録をやめたか、うまくいきませんでした。もう一度お試しください。',
        true
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: PasskeyItem) => {
    if (!confirm(`「${p.device_name ?? 'この端末'}」の指紋・顔認証を外します。よろしいですか。`)) return
    const r = await fetchJson<{ ok: true }>('/api/passkeys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    })
    if (!r.ok) { onNotify(r.json.error, true); return }
    onNotify('外しました。')
    reload()
  }

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--fa-line)' }}>
      <h2 className="fa-cardtitle">指紋・顔認証でログイン</h2>
      <p className="fa-note" style={{ marginTop: 8 }}>
        この端末を登録すると、次からは出席番号とPINを入れずに、指紋や顔でログインできます。
        指紋や顔の情報はスマホの中だけに保存され、園には送られません。
      </p>

      {passkeys.length > 0 && (
        <div className="fa-attlist">
          {passkeys.map((p) => (
            <div key={p.id} className="fa-attrow">
              <div style={{ minWidth: 0 }}>
                <p className="fa-attname">{p.device_name ?? 'この端末'}</p>
                <p className="fa-attmeta">
                  {formatDay(p.created_at)}に登録
                  {p.last_used_at && `　最後に使った日：${formatDay(p.last_used_at)}`}
                </p>
              </div>
              <button onClick={() => remove(p)} className="fa-btn fa-btn--ghost" style={{ flex: '0 0 auto' }}>
                外す
              </button>
            </div>
          ))}
        </div>
      )}

      {supported ? (
        <button
          onClick={register}
          disabled={busy}
          className="fa-btn fa-btn--primary"
          style={{ marginTop: 14 }}
        >
          {busy ? '登録しています…' : 'この端末で指紋・顔認証を使う'}
        </button>
      ) : (
        <p className="fa-note" style={{ marginTop: 12 }}>
          この端末（またはブラウザ）は、指紋・顔認証でのログインに対応していません。
        </p>
      )}

      <p className="fa-note" style={{ marginTop: 10 }}>
        スマホを替えたときは、PINでログインしてから新しいスマホを登録してください。
        園でPINを再発行すると、登録はすべて解除されます。
      </p>
    </div>
  )
}
