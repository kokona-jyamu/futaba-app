/* components/RecipeView.tsx — 料理のレシピの表示（保護者向け・家庭で作れる分量） */

import type { Recipe } from '@/lib/apiTypes'

export default function RecipeView({ name, recipe }: { name: string; recipe: Recipe }) {
  return (
    <div className="fa-recipeview">
      <p className="fa-recipe-title">🍳 {name}</p>
      {recipe.servings && <p className="fa-recipe-servings">{recipe.servings}</p>}

      {recipe.ingredients.length > 0 && (
        <>
          <p className="fa-recipe-h">材料</p>
          <dl className="fa-rv-ings">
            {recipe.ingredients.map((x, i) => (
              <div key={i} className="fa-rv-ing">
                <dt>{x.name}</dt>
                <dd>{x.amount}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {recipe.steps.length > 0 && (
        <>
          <p className="fa-recipe-h">作り方</p>
          <ol className="fa-rv-steps">
            {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}

      {recipe.tip && (
        <p className="fa-recipe-tip">💡 {recipe.tip}</p>
      )}
    </div>
  )
}
