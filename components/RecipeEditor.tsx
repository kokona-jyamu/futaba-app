/* components/RecipeEditor.tsx — 料理の名前とレシピの編集（管理画面）
 *
 * レシピは料理に付くので、直すとその料理を使ったすべての日に反映される。
 * 移し替えで仮に付けた料理名（例：「さばの味噌煮定食」）も、ここで直せる。
 */
'use client'

import { useCallback, useState } from 'react'
import { useLoadEffect, fetchJson } from '@/lib/useLoadEffect'
import type { DishResponse } from '@/lib/apiTypes'

type Props = {
  dishId: string
  onNotify: (msg: string, isError?: boolean) => void
  /** 保存したあと（料理名の変更を一覧に反映するため） */
  onSaved: (dish: DishResponse['dish']) => void
  onClose: () => void
}

type Draft = {
  name: string
  servings: string
  ingredients: { name: string; amount: string }[]
  /** 作り方は1行に1手順で入力する */
  stepsText: string
  tip: string
}

export default function RecipeEditor({ dishId, onNotify, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const request = useCallback(() => fetchJson<DishResponse>(`/api/admin/dishes/${dishId}`), [dishId])
  useLoadEffect(request, (r) => {
    if (!r.ok) { onNotify(r.json.error, true); return }
    const { name, recipe } = r.json.dish
    setDraft({
      name,
      servings: recipe.servings ?? '',
      ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '', amount: '' }],
      stepsText: recipe.steps.join('\n'),
      tip: recipe.tip ?? '',
    })
  })

  if (!draft) return <p className="fa-note" style={{ marginTop: 8 }}>読み込んでいます…</p>

  const setIng = (i: number, key: 'name' | 'amount', value: string) =>
    setDraft({ ...draft, ingredients: draft.ingredients.map((x, j) => (j === i ? { ...x, [key]: value } : x)) })

  const save = async () => {
    setSaving(true)
    const r = await fetchJson<DishResponse>('/api/admin/dishes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: dishId,
        name: draft.name,
        recipe: {
          servings: draft.servings,
          ingredients: draft.ingredients,
          steps: draft.stepsText.split('\n'),
          tip: draft.tip,
        },
      }),
    })
    setSaving(false)
    if (!r.ok) { onNotify(r.json.error, true); return }
    onNotify(`「${r.json.dish.name}」のレシピを保存しました。`)
    onSaved(r.json.dish)
    onClose()
  }

  return (
    <div className="fa-recipeedit">
      <p className="fa-note">
        保護者向け（ご家庭で作れる分量）のレシピです。直すと、この料理を出したすべての日に反映されます。
      </p>

      <label className="fa-label">料理名</label>
      <input
        type="text" value={draft.name} maxLength={60}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        className="fa-input"
      />

      <label className="fa-label">何人分</label>
      <input
        type="text" value={draft.servings} maxLength={40}
        onChange={(e) => setDraft({ ...draft, servings: e.target.value })}
        placeholder="例：大人2人・子ども2人分"
        className="fa-input"
      />

      <label className="fa-label">材料</label>
      {draft.ingredients.map((x, i) => (
        <div key={i} className="fa-recipeedit-ing">
          <input
            type="text" value={x.name} placeholder="材料（例：さば）"
            onChange={(e) => setIng(i, 'name', e.target.value)}
            className="fa-input fa-input--sm"
          />
          <input
            type="text" value={x.amount} placeholder="分量（例：2切れ）"
            onChange={(e) => setIng(i, 'amount', e.target.value)}
            className="fa-input fa-input--sm"
          />
          <button
            type="button" aria-label="この材料を消す" className="fa-filterbtn"
            onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, j) => j !== i) })}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button" className="fa-filterbtn" style={{ marginTop: 6 }}
        onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { name: '', amount: '' }] })}
      >
        ＋ 材料を足す
      </button>

      <label className="fa-label">作り方（1行に1つずつ）</label>
      <textarea
        value={draft.stepsText} rows={5}
        onChange={(e) => setDraft({ ...draft, stepsText: e.target.value })}
        placeholder={'さばに塩をふって10分おく\n鍋にみそ・砂糖・水を入れて煮立てる'}
        className="fa-input fa-textarea"
      />

      <label className="fa-label">ひとことポイント</label>
      <textarea
        value={draft.tip} rows={2} maxLength={400}
        onChange={(e) => setDraft({ ...draft, tip: e.target.value })}
        placeholder="例：しょうがを入れると魚のにおいがやわらぎます"
        className="fa-input fa-textarea"
      />

      <div className="fa-btnrow">
        <button type="button" onClick={save} disabled={saving} className="fa-btn fa-btn--primary">
          {saving ? '保存中…' : 'レシピを保存する'}
        </button>
        <button type="button" onClick={onClose} className="fa-btn fa-btn--ghost">やめる</button>
      </div>
    </div>
  )
}
