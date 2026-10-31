import { localDate, totals, type Meal } from './model';
export type HistoryMode = 'Daily' | 'Weekly' | 'Monthly';
export function historyDays(selected: string, mode: HistoryMode) {
  const anchor = new Date(`${selected}T12:00:00`);
  const start = new Date(anchor), end = new Date(anchor);
  if (mode === 'Weekly') start.setDate(start.getDate() - 6);
  if (mode === 'Monthly') { start.setDate(1); end.setMonth(end.getMonth() + 1, 0); }
  const days: string[] = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) days.push(localDate(day));
  return days;
}
export function historySummary(meals: Meal[], selected: string, mode: HistoryMode) {
  const days = historyDays(selected, mode);
  const allowed = new Set(days);
  const selectedMeals = meals.filter(meal => allowed.has(meal.date)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const buckets = days.map(date => ({ date, meals: selectedMeals.filter(meal => meal.date === date), nutrition: totals(selectedMeals.filter(meal => meal.date === date)) }));
  return { days, meals: selectedMeals, nutrition: totals(selectedMeals), buckets, loggedDays: buckets.filter(day => day.meals.length).length };
}
export const favoriteKey = (meal: Pick<Meal, 'name'>) => meal.name.trim().toLocaleLowerCase();
