/* lib/useLoadEffect.ts — 画面を開いたとき（と条件が変わったとき）のデータ取得
 *
 * request（取得するだけ）と apply（画面に反映する）を分けて渡す。
 *  - request が変わる（＝日付などの条件が変わる）たびに取り直す
 *  - 取り直したあとに古い応答が遅れて届いても、画面には反映しない
 *
 * 保存後などに手動で取り直すときは、request().then(apply) を呼ぶ。
 */
'use client'

import { useEffect, useRef } from 'react'
import type { ApiError } from '@/lib/apiTypes'

export function useLoadEffect<T>(request: () => Promise<T>, apply: (result: T) => void) {
  /* apply は毎回作り直されてもよいように、最新のものを控えておく */
  const applyRef = useRef(apply)
  useEffect(() => {
    applyRef.current = apply
  })

  useEffect(() => {
    let active = true
    request().then((result) => {
      if (active) applyRef.current(result)
    })
    return () => {
      active = false
    }
  }, [request])
}

/** fetchJson の結果。ok を確かめると、json が成功時・失敗時どちらの形か決まる */
export type FetchResult<T> =
  | { ok: true; status: number; json: T }
  | { ok: false; status: number; json: ApiError }

/**
 * JSON を返す API を呼び、結果をまとめて返す（画面への反映は呼び出し側で行う）。
 * T には lib/apiTypes の応答の型を渡す。
 */
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<FetchResult<T>> {
  const res = await fetch(input, init)
  const json: unknown = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, status: res.status, json: json as T }

  const error = (json as Partial<ApiError>)?.error
  return { ok: false, status: res.status, json: { error: error ?? '通信に失敗しました' } }
}
