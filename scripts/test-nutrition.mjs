import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
process.env.FITMACRO_LOCAL_PREVIEW = 'true';
async function moduleFrom(path) {
  const output = await build({ entryPoints: [path], bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
}
const { parseEstimate, scaleNutrition } = await moduleFrom('dashboard/src/nutrition.ts');
const macros = { calories: 160, protein: 12.5, carbs: 1.2, fat: 10 };
assert.deepEqual(parseEstimate({ ...macros, ai_summary: 'Two eggs' }), { nutrition: macros, summary: 'Two eggs' });
assert.equal(parseEstimate({ nutrition: { calories: 50, protein: 0, carbohydrates: 12, fats: 0 } }).nutrition.carbs, 12);
for (const invalid of [null, {}, { ...macros, calories: -1 }, { ...macros, protein: '12' }, { calories: 0, protein: 0, carbs: 0, fat: 0 }, { ...macros, fat: Infinity }]) assert.throws(() => parseEstimate(invalid));
assert.deepEqual(scaleNutrition({ calories: 100, protein: 10, carbs: 20, fat: 3 }, 150, 100), { calories: 150, protein: 15, carbs: 30, fat: 4.5 });
assert.throws(() => scaleNutrition(macros, 0, 100));
assert.throws(() => scaleNutrition(macros, 100, 0));
const detailed = parseEstimate({ ...macros, ui_title: 'Eggs', ui_subtitle: 'Breakfast', ai_foods: [null, { name: '' }, { name: 'egg', quantity: 2, unit: 'piece', display: '2 eggs' }] });
assert.equal(detailed.title, 'Eggs'); assert.equal(detailed.foods.length, 1); assert.equal(detailed.foods[0].quantity, 2);
const { default: handler } = await moduleFrom('api/analyze.ts');
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.equal(new URL(url).pathname, '/api/new_ui_copy');
  assert.deepEqual(JSON.parse(options.body), { description: '2 boiled eggs', language: 'en' });
  assert.equal(options.method, 'POST');
  return Response.json({ ...macros, ai_summary: 'Two boiled eggs' });
};
async function invoke(overrides = {}) {
  const req = { socket: { remoteAddress: 'test-client' }, method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': 'test-client' }, body: { description: ' 2 boiled eggs ', photoUrl: 'https://not-forwarded.invalid/image.jpg' }, ...overrides };
  const res = { statusCode: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  await handler(req, res); return res;
}
try {
  assert.equal((await invoke({ method: 'GET' })).statusCode, 405);
  assert.equal((await invoke({ headers: {} })).statusCode, 415);
  for (const description of ['', '   ', 12, 'a'.repeat(501)]) assert.equal((await invoke({ body: { description } })).statusCode, 400);
  assert.equal(calls, 0);
  const success = await invoke();
  assert.equal(success.statusCode, 200);
  assert.deepEqual(success.body, { ...macros, ai_summary: 'Two boiled eggs' });
  assert.equal(success.headers['Cache-Control'], 'no-store');
  for (let n = 1; n < 3; n++) assert.equal((await invoke()).statusCode, 200);
  const blocked = await invoke(); assert.equal(blocked.statusCode, 429); assert.equal(blocked.body.code, 'daily_limit'); assert.equal(calls, 3);
  const corrections = [{ name: 'egg', quantity: 3, unit: 'piece', weight_g: null }];
  globalThis.fetch = async (url, options) => {
    assert.deepEqual(JSON.parse(options.body).correctedIngredients, corrections);
    return Response.json({ ...macros, ai_summary: 'Three eggs', ui_title: 'Eggs', ai_foods: [{ name: 'egg', quantity: 3, unit: 'piece' }] });
  };
  const corrected = await invoke({ socket: { remoteAddress: 'correction-client' }, headers: { 'content-type': 'application/json' }, body: { description: '2 boiled eggs', correctedIngredients: corrections } });
  assert.equal(corrected.statusCode, 200); assert.equal(corrected.body.ai_foods[0].quantity, 3); assert.equal(corrected.body.ui_title, 'Eggs');
  assert.equal((await invoke({ body: { description: 'eggs', correctedIngredients: [{ name: 'egg', quantity: -1, unit: 'piece', weight_g: null }] } })).statusCode, 400);
  const otherClient = { socket: { remoteAddress: 'other-client' }, headers: { 'content-type': 'application/json', 'x-real-ip': 'other-client' } };
  globalThis.fetch = async () => Response.json({ error: 'private internal details' }, { status: 500 });
  const failed = await invoke(otherClient); assert.equal(failed.statusCode, 502); assert(!failed.body.error.includes('private'));
  globalThis.fetch = async () => Response.json({ calories: 5 });
  assert.equal((await invoke(otherClient)).statusCode, 502);
  globalThis.fetch = async () => { throw new Error('internal connection error'); };
  assert.equal((await invoke(otherClient)).statusCode, 502);
  globalThis.fetch = async () => Response.json({ ...macros });
  for (let n = 0; n < 3; n++) assert.equal((await invoke(otherClient)).statusCode, 200);
  assert.equal((await invoke(otherClient)).body.code, 'daily_limit');
} finally { globalThis.fetch = originalFetch; }
console.log('AI checks passed: response validation, guest access, request bounds, text-only forwarding, server daily limits, and backend failure refunds.');
