import { getLanguage, t } from './i18n.js';
import { isNutrition, type Nutrition } from './model.js';
export type Food = { name: string; quantity?: number; unit?: string; weight_g?: number; display?: string };
export type CorrectedIngredient = { name: string; quantity: number | null; unit: string; weight_g: number | null };
export type Estimate = { nutrition: Nutrition; summary: string; title?: string; subtitle?: string; foods?: Food[] };
export function scaleNutrition(nutrition: Nutrition, amount: number, baseAmount: number): Nutrition {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(baseAmount) || baseAmount <= 0) throw new Error('Enter a valid portion amount.');
  return Object.fromEntries(Object.entries(nutrition).map(([key, n]) => [key, Math.round(n * amount / baseAmount * (key === 'calories' ? 1 : 10)) / (key === 'calories' ? 1 : 10)])) as Nutrition;
}
export function parseEstimate(value: unknown): Estimate {
  if (!value || typeof value !== 'object') throw new Error('The nutrition service returned an invalid result. Please try again.');
  const data = value as Record<string, unknown>;
  // Mobile routes may return flat macros or a nested nutrition object.
  const source = data.nutrition && typeof data.nutrition === 'object' ? data.nutrition as Record<string, unknown> : data;
  const nutrition = { calories: source.calories, protein: source.protein, carbs: source.carbs ?? source.carbohydrates, fat: source.fat ?? source.fats };
  if (!isNutrition(nutrition) || Object.values(nutrition).every(n => n === 0)) throw new Error('No usable nutrition estimate was returned. Try a more specific meal description or enter the numbers manually.');
  const summary = typeof data.ai_summary === 'string' ? data.ai_summary : typeof data.meal_description === 'string' ? data.meal_description : '';
  const estimate: Estimate = { nutrition, summary: summary.slice(0, 1500) };
  if (typeof data.ui_title === 'string') estimate.title = data.ui_title.slice(0, 200);
  if (typeof data.ui_subtitle === 'string') estimate.subtitle = data.ui_subtitle.slice(0, 500);
  if (Array.isArray(data.ai_foods)) estimate.foods = data.ai_foods.slice(0, 40).filter((food): food is Record<string, unknown> => Boolean(food && typeof food === 'object' && typeof food.name === 'string' && food.name.trim())).map(food => ({
    name: String(food.name).slice(0, 150),
    ...(typeof food.quantity === 'number' && Number.isFinite(food.quantity) && food.quantity > 0 ? { quantity: food.quantity } : {}),
    ...(typeof food.weight_g === 'number' && Number.isFinite(food.weight_g) && food.weight_g > 0 ? { weight_g: food.weight_g } : {}),
    ...(typeof food.unit === 'string' ? { unit: food.unit.slice(0, 40) } : {}),
    ...(typeof food.display === 'string' ? { display: food.display.slice(0, 250) } : {}),
  }));
  return estimate;
}
export async function analyzeMeal(description: string, signal: AbortSignal, correctedIngredients?: CorrectedIngredient[], image?: string): Promise<Estimate> {
  const { authorizedFetch } = await import('./subscriptions.js');
  const response = await authorizedFetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description, language: getLanguage(), ...(image ? { image } : {}), ...(correctedIngredients ? { correctedIngredients } : {}) }), signal });
  window.dispatchEvent(new Event('fitmacro:usage'));
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(t(typeof result?.error === 'string' ? result.error : 'The nutrition service is unavailable. Please try again.'));
  return parseEstimate(result);
}
