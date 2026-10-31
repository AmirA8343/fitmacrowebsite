import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
process.env.FITMACRO_LOCAL_PREVIEW = 'true';
delete process.env.VERCEL;
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.REVENUECAT_API_KEY;
async function load(path) {
  const output = await build({ entryPoints: [path], bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
}
const { subscriptionTier, checkoutUrl, access, identify } = await load('server/billing.ts');
const now = Date.parse('2026-10-30T12:00:00Z');
function customer({ expires = '2026-11-30T12:00:00Z', grace = null, sandbox = false, entitlement = 'premium' } = {}) {
  return { entitlements: { [entitlement]: { product_identifier: 'monthly', purchase_date: '2026-10-01T12:00:00Z', expires_date: expires, grace_period_expires_date: grace } }, subscriptions: { monthly: { is_sandbox: sandbox } } };
}
assert.equal(subscriptionTier(customer(), now), 'pro');
assert.equal(subscriptionTier(customer({ entitlement: 'fitmacro.pro_plus.monthly' }), now), 'pro_plus');
assert.equal(subscriptionTier(customer({ expires: '2026-10-29T12:00:00Z' }), now), 'free');
assert.equal(subscriptionTier(customer({ expires: '2026-10-29T12:00:00Z', grace: '2026-11-02T12:00:00Z' }), now), 'pro');
assert.equal(subscriptionTier(customer({ sandbox: true }), now), 'free');
assert.equal(subscriptionTier(customer({ sandbox: true }), now, true), 'pro');
assert.equal(subscriptionTier(customer({ entitlement: 'fake-pro' }), now), 'free');
assert.equal(subscriptionTier({ entitlements: { premium: { expires_date: null } } }, now), 'free');
assert.throws(() => checkoutUrl('user-1'));
process.env.REVENUECAT_PURCHASE_LINK = 'https://pay.rev.cat/example-token';
assert.equal(checkoutUrl('firebase uid/+'), 'https://pay.rev.cat/example-token/firebase%20uid%2F%2B');
process.env.REVENUECAT_ALLOW_SANDBOX = 'true';
process.env.REVENUECAT_PURCHASE_LINK = 'https://pay.rev.cat/sandbox/example-token';
assert.equal(checkoutUrl('firebase uid/+'), 'https://pay.rev.cat/sandbox/example-token/firebase%20uid%2F%2B');
process.env.VERCEL_ENV = 'production';
assert(checkoutUrl('user').includes('/sandbox/example-token/user'));
process.env.REVENUECAT_ALLOW_SANDBOX = 'false';
assert.throws(() => checkoutUrl('user'));
process.env.REVENUECAT_ALLOW_SANDBOX = 'true';
process.env.VERCEL_ENV = 'preview';
assert(checkoutUrl('user').includes('/sandbox/example-token/user'));
delete process.env.VERCEL_ENV;
process.env.REVENUECAT_PURCHASE_LINK = 'https://attacker.invalid/checkout'; assert.throws(() => checkoutUrl('user'));
delete process.env.REVENUECAT_PURCHASE_LINK;
const req = { headers: {}, socket: { remoteAddress: 'quota-concurrent' } };
assert.equal(await identify(req), null);
await assert.rejects(identify({ headers: { authorization: 'Bearer definitely-invalid' } }), e => e.status === 401);
const results = await Promise.allSettled(Array.from({ length: 8 }, () => access(req, null, true)));
assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'daily_limit').length, 5);
assert.equal((await access(req, null)).status.remaining, 0);
const reservation = results.find(r => r.status === 'fulfilled').value;
await reservation.release(); await reservation.release();
assert.equal((await access(req, null)).status.remaining, 1); // Refund once only.
assert.equal((await access(req, 'different-account')).status.remaining, 3);
const originalFetch = globalThis.fetch;
process.env.REVENUECAT_API_KEY = 'test-key-never-sent';
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://api.revenuecat.com/v1/subscribers/firebase-uid');
  assert.equal(options.headers.Authorization, 'Bearer test-key-never-sent');
  return Response.json({ subscriber: customer({ expires: '2099-11-30T12:00:00Z' }) });
};
try {
  const paid = await access(req, 'firebase-uid', true);
  assert.equal(paid.status.tier, 'pro'); assert.equal(paid.status.remaining, null);
  globalThis.fetch = async () => Response.json({}, { status: 503 });
  await assert.rejects(access(req, 'firebase-uid', true), e => e.status === 503);
} finally { globalThis.fetch = originalFetch; delete process.env.REVENUECAT_API_KEY; }
process.env.VERCEL = '1'; process.env.FITMACRO_USAGE_SALT = 'test-only';
await assert.rejects(access({ headers: { 'x-vercel-forwarded-for': '192.0.2.1' } }, null), e => e.status === 503);
console.log('Billing checks passed: matching mobile entitlements, expiry/grace/sandbox rules, verified identity requirement, checkout identity binding, atomic preview quota/refunds, and production fail-closed configuration.');
