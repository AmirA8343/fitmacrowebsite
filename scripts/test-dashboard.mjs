import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['dashboard/src/model.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { initialData, localDate, validDate, parseData, totals } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
assert.equal(localDate(new Date(2026, 9, 30, 23, 59)), '2026-10-30');
assert.equal(localDate(new Date(2026, 9, 31, 0, 1)), '2026-10-31');
assert.equal(validDate('2026-02-30'), false);
assert.equal(validDate('2028-02-29'), true);
assert.equal(validDate('2026-02-29'), false);
const meal = { id: 'one', name: 'Lunch', date: '2026-10-30', createdAt: '2026-10-30T16:00:00Z', calories: 480, protein: 35, carbs: 50, fat: 15 };
const saved = { ...initialData, meals: [meal, { ...meal, id: 'two', date: '2026-10-29', calories: 200 }] };
assert.deepEqual(parseData(JSON.stringify(saved)), saved);
assert.equal(totals(saved.meals.filter(m => m.date === '2026-10-30')).calories, 480);
assert.equal(totals([]).protein, 0);
for (const corrupt of [null, {}, { ...initialData, version: 2 }, { ...initialData, targets: { ...initialData.targets, calories: 0 } }, { ...initialData, meals: [{ ...meal, protein: -1 }] }, { ...initialData, meals: [{ ...meal, date: '2026-02-30' }] }]) {
  assert.throws(() => parseData(JSON.stringify(corrupt)));
}
console.log('Dashboard checks passed: date boundaries, daily totals, saved-data round trip, and corrupt-data rejection.');

const profileBuild = await build({ entryPoints: ['dashboard/src/profile.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { calculateTargets, isProfile, storageKeyForUser } = await import(`data:text/javascript;base64,${Buffer.from(profileBuild.outputFiles[0].text).toString('base64')}`);
const profile = { age: 25, weight: 70, height: 170, gender: 'male', goal: 'maintenance' };
assert.deepEqual(calculateTargets(profile), { calories: 2300, protein: 140, carbs: 288, fat: 77 });
assert.equal(calculateTargets({ ...profile, goal: 'gain' }).calories, 2550);
assert.equal(calculateTargets({ ...profile, goal: 'lose' }).calories, 1800);
assert.deepEqual(calculateTargets({ ...profile, gender: 'female' }), { calories: 2067, protein: 140, carbs: 258, fat: 69 });
assert.equal(isProfile({ ...profile, weight: NaN }), false);
assert.equal(isProfile({ ...profile, age: 0 }), false);
assert.throws(() => calculateTargets({ ...profile, gender: 'invalid' }));
const personalized = { ...saved, profile, setupCompleted: true };
assert.deepEqual(parseData(JSON.stringify(personalized)), personalized);
assert.throws(() => parseData(JSON.stringify({ ...saved, profile: { ...profile, age: -1 } })));
assert.throws(() => parseData(JSON.stringify({ ...saved, setupCompleted: 'yes' })));
assert.equal(storageKeyForUser(null), 'fitmacro.web.v1'); // Preserve existing guest logs.
assert.notEqual(storageKeyForUser('alice'), storageKeyForUser('bob'));
assert.notEqual(storageKeyForUser('alice'), storageKeyForUser(null));
console.log('Profile checks passed: mobile calorie/macro parity, goal adjustments, profile validation, backward-compatible storage, and account isolation.');

const historyBuild = await build({ entryPoints: ['dashboard/src/history.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { historyDays, historySummary, favoriteKey } = await import(`data:text/javascript;base64,${Buffer.from(historyBuild.outputFiles[0].text).toString('base64')}`);
assert.deepEqual(historyDays('2026-01-02', 'Weekly'), ['2025-12-27', '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
assert.equal(historyDays('2028-02-10', 'Monthly').length, 29);
assert.equal(historyDays('2026-02-10', 'Monthly').length, 28);
assert.deepEqual(historyDays('2026-10-30', 'Daily'), ['2026-10-30']);
const week = historySummary(saved.meals, '2026-10-30', 'Weekly');
assert.equal(week.nutrition.calories, 680); assert.equal(week.loggedDays, 2); assert.equal(week.meals.length, 2);
assert.equal(historySummary(saved.meals, '2026-10-29', 'Daily').nutrition.calories, 200);
assert.equal(historySummary(saved.meals, '2026-09-30', 'Monthly').meals.length, 0);
const withFavorite = { ...saved, favorites: [{ ...meal, id: 'favorite-copy' }] };
assert.deepEqual(parseData(JSON.stringify(withFavorite)), withFavorite);
assert.equal(parseData(JSON.stringify({ ...withFavorite, meals: [] })).favorites.length, 1);
assert.throws(() => parseData(JSON.stringify({ ...saved, favorites: [{ ...meal, protein: -1 }] })));
assert.equal(favoriteKey({ name: ' Lunch ' }), favoriteKey({ name: 'lunch' }));
console.log('History checks passed: year/leap-month boundaries, daily and weekly totals, favorite persistence, and corrupt favorite rejection.');
