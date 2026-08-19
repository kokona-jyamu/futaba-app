/* components/AllergenPicker.tsx
 *
 * アレルゲン選択。
 *  - 義務8品目は常に表示
 *  - 推奨20品目＋園独自は「もっと見る」で展開
 *  - 「アレルゲンなし」を明示的に選べる（未入力と区別するため）
 */
'use client'

import { useState, useMemo } from 'react'
import {
  REQUIRED_ALLERGENS,
  OPTIONAL_ALLERGENS,
  hasAnyAllergen,
  type AllergenDef,
  type CustomAllergen,
} from '@/lib/allergens'

type Props = {
  value: Record<string, boolean>
  onToggle?: (key: string) => void
  /** 「該当なし」を押したとき。投稿画面でのみ渡す */
  onDeclareNone?: () => void
  /** 確認済みかどうか。false なら未確認の警告を出す */
  checked?: boolean
  /** 園が独自に追加したアレルゲン */
  custom?: CustomAllergen[]
  /** 表示だけ（保護者画面用）。ONのものだけ並べる */
  readOnly?: boolean
}

export default function AllergenPicker({
  value,
  onToggle,
  onDeclareNone,
  checked,
  custom = [],
  readOnly = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const optional: AllergenDef[] = useMemo(
    () => [
      ...OPTIONAL_ALLERGENS,
      ...custom.map((c) => ({
        key: c.key,
        label: c.label,
        emoji: c.emoji ?? '🍽️',
        required: false,
      })),
    ],
    [custom]
  )

  const anySelected = hasAnyAllergen(value)

  /* 推奨側で選ばれているものがあれば最初から開いておく */
  const optionalSelected = optional.some((a) => value?.[a.key] === true)
  const open = expanded || optionalSelected

  const chip = (a: AllergenDef) => {
    const on = !!value?.[a.key]
    if (readOnly && !on) return null
    return (
      <button
        type="button"
        key={a.key}
        onClick={readOnly ? undefined : () => onToggle?.(a.key)}
        aria-pressed={readOnly ? undefined : on}
        disabled={readOnly}
        className={`fa-chip${on ? ' is-on' : ''}`}
        style={readOnly ? { cursor: 'default' } : undefined}
        title={a.label}
      >
        <span className="fa-chip-emoji">{a.emoji}</span>
        <span className="fa-chip-label">{a.label}</span>
      </button>
    )
  }

  /* ---------------- 表示のみ（保護者画面） ---------------- */
  if (readOnly) {
    const shown = [...REQUIRED_ALLERGENS, ...optional].filter(
      (a) => value?.[a.key] === true
    )
    if (shown.length === 0) {
      return (
        <p className="fa-algnone">
          {checked
            ? '✓ 特定原材料にあたる食材は使っていません'
            : '？ アレルギー情報は登録されていません'}
        </p>
      )
    }
    return <div className="fa-chips">{shown.map(chip)}</div>
  }

  /* ---------------- 入力（管理画面） ---------------- */
  return (
    <div>
      {checked === false && (
        <p className="fa-algwarn">
          まだ確認されていません。使っている食材を選ぶか、
          ひとつも該当しない場合は「該当なし」を押してください。
        </p>
      )}

      <p className="fa-alggroup">表示義務8品目</p>
      <div className="fa-chips">{REQUIRED_ALLERGENS.map(chip)}</div>

      <button
        type="button"
        onClick={() => setExpanded(!open)}
        className="fa-expand"
        aria-expanded={open}
      >
        {open ? '▲ 推奨20品目を閉じる' : `▼ 推奨20品目・独自の食材も選ぶ（${optional.length}件）`}
      </button>

      {open && (
        <>
          <p className="fa-alggroup">表示推奨20品目{custom.length > 0 && '・園で追加した食材'}</p>
          <div className="fa-chips">{optional.map(chip)}</div>
        </>
      )}

      {onDeclareNone && (
        <div className="fa-algnonerow">
          <button
            type="button"
            onClick={onDeclareNone}
            className={`fa-algnonebtn${checked && !anySelected ? ' is-on' : ''}`}
            aria-pressed={checked && !anySelected}
          >
            {checked && !anySelected
              ? '✓ 該当なしとして登録済み'
              : 'どれも使っていない（該当なし）'}
          </button>
        </div>
      )}
    </div>
  )
}