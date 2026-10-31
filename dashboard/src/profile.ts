import type { Nutrition } from './model.js';
export type Profile = { age: number; weight: number; height: number; gender: 'male' | 'female'; goal: 'maintenance' | 'lose' | 'gain' };
export function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Profile;
  return Number.isInteger(p.age) && p.age >= 18 && p.age <= 100 && Number.isFinite(p.weight) && p.weight >= 30 && p.weight <= 350 && Number.isFinite(p.height) && p.height >= 120 && p.height <= 230 && ['male', 'female'].includes(p.gender) && ['maintenance', 'lose', 'gain'].includes(p.goal);
}
// Mirrors mobile lib/mealStorage.ts and lib/nutritionGoals.ts.
export function calculateTargets(profile: Profile): Nutrition {
  if (!isProfile(profile)) throw new Error('Please check your profile details.');
  const { weight, height, age, gender, goal } = profile;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const maintenance = Math.round(bmr * 1.4);
  const calories = maintenance + (goal === 'gain' ? 250 : goal === 'lose' ? -500 : 0);
  if (calories <= 0) throw new Error('These details could not produce a calorie estimate. You can set your targets manually.');
  return { calories, protein: Math.round(weight * 2), carbs: Math.round(calories * .5 / 4), fat: Math.round(calories * .3 / 9) };
}
export function storageKeyForUser(uid: string | null) { return uid ? `fitmacro.web.v1.user.${uid}` : 'fitmacro.web.v1'; }
