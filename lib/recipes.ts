/* lib/recipes.ts — 料理のレシピ（保護者向け・家庭で作れる分量）の共通処理
 *
 * dishes の列：
 *   recipe_servings    … 何人分（例：大人2人・子ども2人分）
 *   recipe_ingredients … 材料と分量 [{ name, amount }]（jsonb）
 *   recipe_steps       … 作り方（手順ごと）
 *   recipe_tip         … ひとことポイント
 * レシピは料理に付くので、過去の料理を選べばレシピも引き継がれる。
 */

import type { Recipe } from '@/lib/apiTypes'
import type { TablesUpdate } from '@/lib/database.types'

const SERVINGS_MAX = 40
const INGREDIENT_MAX = 40
const STEP_MAX = 30
const TEXT_MAX = 400

export const emptyRecipe = (): Recipe => ({ servings: null, ingredients: [], steps: [], tip: null })

/** DB の行からレシピを取り出す（形の分からない jsonb も安全に読む） */
export const toRecipe = (row: {
  recipe_servings: string | null
  recipe_ingredients: unknown
  recipe_steps: string[] | null
  recipe_tip: string | null
}): Recipe => ({
  servings: row.recipe_servings,
  ingredients: Array.isArray(row.recipe_ingredients)
    ? row.recipe_ingredients.flatMap((x) =>
        x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string'
          ? [{
              name: (x as { name: string }).name,
              amount: String((x as { amount?: unknown }).amount ?? ''),
            }]
          : []
      )
    : [],
  steps: row.recipe_steps ?? [],
  tip: row.recipe_tip,
})

/** レシピが1つでも入っているか */
export const hasRecipe = (r: Recipe): boolean =>
  !!r.servings || r.ingredients.length > 0 || r.steps.length > 0 || !!r.tip

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/** 画面から届いたレシピを検証し、DB の列の形にする（API 用） */
export function sanitizeRecipe(input: unknown): TablesUpdate<'dishes'> {
  const r = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof Recipe, unknown>>

  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients
        .map((x) => ({
          name: text((x as { name?: unknown })?.name, TEXT_MAX) ?? '',
          amount: text((x as { amount?: unknown })?.amount, TEXT_MAX) ?? '',
        }))
        .filter((x) => x.name)
        .slice(0, INGREDIENT_MAX)
    : []

  const steps = Array.isArray(r.steps)
    ? r.steps.map((s) => text(s, TEXT_MAX)).filter((s): s is string => !!s).slice(0, STEP_MAX)
    : []

  return {
    recipe_servings: text(r.servings, SERVINGS_MAX),
    recipe_ingredients: ingredients,
    recipe_steps: steps.length > 0 ? steps : null,
    recipe_tip: text(r.tip, TEXT_MAX),
  }
}
