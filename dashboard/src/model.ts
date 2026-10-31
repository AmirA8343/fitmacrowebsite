import { isProfile, type Profile } from './profile.js';
export const nutrients = ['calories', 'protein', 'carbs', 'fat'] as const;
export type Nutrient = typeof nutrients[number];
export type Nutrition = Record<Nutrient, number>;
export type Meal = Nutrition & { id: string; name: string; date: string; createdAt: string };
export type Data = { version: 1; targets: Nutrition; meals: Meal[]; profile?: Profile; setupCompleted?: boolean; favorites?: Meal[] };
export const initialData: Data = { version: 1, targets: { calories: 1800, protein: 140, carbs: 225, fat: 60 }, meals: [] };
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && localDate(new Date(`${value}T12:00:00`)) === value;
}
export function isNutrition(value: unknown, positive = false): value is Nutrition {
  if (!value || typeof value !== 'object') return false;
  return nutrients.every(key => { const n = (value as Nutrition)[key]; return typeof n === 'number' && Number.isFinite(n) && (positive ? n > 0 : n >= 0); });
}
function isMeal(m: Meal) {
  return m && isNutrition(m) && typeof m.id === 'string' && typeof m.name === 'string' && m.name.trim() && typeof m.date === 'string' && validDate(m.date) && typeof m.createdAt === 'string' && Number.isFinite(Date.parse(m.createdAt));
}
export function parseData(raw: string): Data {
  const data = JSON.parse(raw) as Data;
  if ((data.favorites !== undefined && (!Array.isArray(data.favorites) || !data.favorites.every(isMeal))) || (data.profile !== undefined && !isProfile(data.profile)) || (data.setupCompleted !== undefined && typeof data.setupCompleted !== 'boolean') || data.version !== 1 || !isNutrition(data.targets, true) || !Array.isArray(data.meals) || !data.meals.every(isMeal)) throw new Error('Invalid saved data');
  return data;
}
export function totals(meals: Meal[]): Nutrition {
  return meals.reduce((sum, meal) => Object.fromEntries(nutrients.map(key => [key, sum[key] + meal[key]])) as Nutrition, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}
