/* components/AllergenPicker.tsx */
'use client'

import { ALLERGENS, type Allergens } from '@/lib/menu'

export default function AllergenPicker({
  value,
  onToggle,
  readOnly = false,
}: {
  value: Allergens
  onToggle?: (key: string) => void
  /** 保護者画面など、表示だけしたい場合は true */
  readOnly?: boolean
}) {
  return (
    <div className="fa-chips">
      {ALLERGENS.map((a) => {
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
          >
            <span className="fa-chip-emoji">{a.emoji}</span>
            <span className="fa-chip-label">{a.label}</span>
          </button>
        )
      })}
    </div>
  )
}