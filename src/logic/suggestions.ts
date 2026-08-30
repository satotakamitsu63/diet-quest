import { FOODS, type Food } from '../data/foods';
import { NUTRIENT_LABELS, NUTRIENT_UNITS, scaleNutrients, type NutrientKey } from '../data/nutrients';
import type { DailySummary } from './score';

export type Suggestion = {
  nutrient: NutrientKey;
  label: string;
  shortfall: number;
  unit: string;
  foods: Array<{ food: Food; amountInServing: number }>;
};

const EXCLUDED_CATEGORIES = new Set(['菓子', '飲料']);

/** 1食分あたりでその栄養素を多く含む食品を選ぶ。 */
function findRichFoods(nutrient: NutrientKey, limit: number): Array<{ food: Food; amountInServing: number }> {
  return FOODS.filter((food) => !EXCLUDED_CATEGORIES.has(food.category))
    .map((food) => ({
      food,
      amountInServing: scaleNutrients(food.per100g, food.servingGrams)[nutrient],
    }))
    .filter((entry) => entry.amountInServing > 0)
    .sort((left, right) => right.amountInServing - left.amountInServing)
    .slice(0, limit);
}

/** 不足している栄養素を上位から拾い、それを補える食品を提案する。 */
export function buildSuggestions(summary: DailySummary, limit = 3): Suggestion[] {
  return summary.shortfalls
    .filter((nutrient) => nutrient !== 'energy' && nutrient !== 'carbohydrate')
    .map((nutrient) => ({
      nutrient,
      ratio: summary.ratios[nutrient],
      shortfall: Math.max(0, summary.targets[nutrient] - summary.totals[nutrient]),
    }))
    .sort((left, right) => left.ratio - right.ratio)
    .slice(0, limit)
    .map((entry) => ({
      nutrient: entry.nutrient,
      label: NUTRIENT_LABELS[entry.nutrient],
      shortfall: Math.round(entry.shortfall * 10) / 10,
      unit: NUTRIENT_UNITS[entry.nutrient],
      foods: findRichFoods(entry.nutrient, 3),
    }));
}
