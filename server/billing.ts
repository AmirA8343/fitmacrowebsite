import { createHmac } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ENTITLEMENTS, FREE_DAILY_ANALYSES, type Access } from '../shared/plans';
export class AccessError extends Error { constructor(public status: number, message: string, public code = 'unavailable') { super(message); } }
const PROJECT = 'fitmacro-e0d48';
const localPreview = () => process.env.FITMACRO_LOCAL_PREVIEW === 'true' && !process.env.VERCEL;
export function adminApp() {
  const existing = getApps().find(app => app.name === 'fitmacro-web');
  if (existing) return existing;
  const service = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (service) {
    const parsed = JSON.parse(service);
    if (parsed.project_id !== PROJECT) throw new AccessError(503, 'The web service is not configured for FitMacro.');
    return initializeApp({ credential: cert(parsed), projectId: PROJECT }, 'fitmacro-web');
  }
  return initializeApp({ projectId: PROJECT }, 'fitmacro-web');
}
export async function identify(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header) return null;
  if (!header.startsWith('Bearer ')) throw new AccessError(401, 'Please sign in again.', 'sign_in');
  try { return (await getAuth(adminApp()).verifyIdToken(header.slice(7))).uid; }
  catch { throw new AccessError(401, 'Your session could not be verified. Please sign in again.', 'sign_in'); }
}
type RecordValue = Record<string, any>;
export function subscriptionTier(subscriber: RecordValue, now = Date.now(), allowSandbox = false): Access['tier'] {
  for (const tier of ['pro_plus', 'pro'] as const) {
    const entitlement = subscriber.entitlements?.[ENTITLEMENTS[tier]];
    if (!entitlement || typeof entitlement.product_identifier !== 'string' || !Number.isFinite(Date.parse(entitlement.purchase_date)) || Date.parse(entitlement.purchase_date) > now) continue;
    const expires = entitlement.expires_date;
    const grace = Date.parse(entitlement.grace_period_expires_date ?? '');
    if (expires !== null && (!Number.isFinite(Date.parse(expires)) || (Date.parse(expires) <= now && !(grace > now)))) continue;
    const receipt = subscriber.subscriptions?.[entitlement.product_identifier] ?? subscriber.non_subscriptions?.[entitlement.product_identifier]?.find((item: RecordValue) => item.purchase_date === entitlement.purchase_date);
    if (!receipt || typeof receipt.is_sandbox !== 'boolean' || (receipt.is_sandbox && !allowSandbox)) continue;
    return tier;
  }
  return 'free';
}
export async function revenueCat(uid: string | null): Promise<{ tier: Access['tier']; managementUrl?: string }> {
  if (!uid || !process.env.REVENUECAT_API_KEY) return { tier: 'free' };
  let response: Response;
  try { response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${process.env.REVENUECAT_API_KEY}` }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new AccessError(503, 'Subscription status could not be checked. Please try again.'); }
  if (!response.ok) throw new AccessError(503, 'Subscription status could not be checked. Please try again.');
  const data = await response.json();
  if (!data?.subscriber || typeof data.subscriber.entitlements !== 'object') throw new AccessError(503, 'Subscription status is unavailable.');
  const tier = subscriptionTier(data.subscriber, Date.now(), process.env.REVENUECAT_ALLOW_SANDBOX === 'true' && process.env.VERCEL_ENV !== 'production');
  const management = data.subscriber.management_url;
  return { tier, ...(typeof management === 'string' && management.startsWith('https://') ? { managementUrl: management } : {}) };
}
export function checkoutUrl(uid: string) {
  const configured = process.env.REVENUECAT_PURCHASE_LINK;
  if (!configured) throw new AccessError(503, 'Web subscriptions are being prepared. You can keep using free analyses and manual logging.', 'checkout_unavailable');
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.hostname !== 'pay.rev.cat' || url.search || url.hash || !/^\/[^/]+\/?$/.test(url.pathname)) throw new AccessError(503, 'Web checkout has not been configured correctly.');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(uid)}`;
  return url.toString();
}
function day() { const now = new Date(); return { key: now.toISOString().slice(0, 10), resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString() }; }
const previewGlobal = globalThis as typeof globalThis & { __fitmacroWebUsage?: Map<string, number> };
const memory = previewGlobal.__fitmacroWebUsage ??= new Map<string, number>();
function usageId(req: VercelRequest, uid: string | null) {
  const salt = process.env.FITMACRO_USAGE_SALT || (localPreview() ? 'local-preview-only' : '');
  if (!salt) throw new AccessError(503, 'Daily allowances are being configured. Manual logging is still available.');
  // Vercel supplies the client IP. Locally, use the socket address, never browser-supplied identities.
  const ip = process.env.VERCEL ? String(req.headers['x-vercel-forwarded-for'] ?? req.headers['x-real-ip'] ?? '') : req.socket?.remoteAddress ?? 'local';
  if (!uid && !ip) throw new AccessError(503, 'Daily allowance could not be checked.');
  return createHmac('sha256', salt).update(uid ? `user:${uid}` : `guest-network:${ip}`).digest('hex') + '_' + day().key;
}
async function changeUsage(id: string, delta: number, maximum = FREE_DAILY_ANALYSES) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    if (!localPreview()) throw new AccessError(503, 'Daily allowances are being configured. Manual logging is still available.');
    const count = memory.get(id) ?? 0;
    if (delta > 0 && count >= maximum) throw new AccessError(429, 'You’ve used today’s 3 free AI analyses. Upgrade for more, or use manual logging. Free access resets at midnight UTC.', 'daily_limit');
    const next = Math.max(0, count + delta); memory.set(id, next); return next;
  }
  const db = getFirestore(adminApp());
  const ref = db.collection('fitmacroWebUsage').doc(id);
  return db.runTransaction(async transaction => {
    const record = await transaction.get(ref);
    const count = record.exists ? record.get('count') : 0;
    if (!Number.isInteger(count) || count < 0) throw new AccessError(503, 'Daily allowance could not be checked.');
    if (delta > 0 && count >= maximum) throw new AccessError(429, 'You’ve used today’s 3 free AI analyses. Upgrade for more, or use manual logging. Free access resets at midnight UTC.', 'daily_limit');
    const next = Math.max(0, count + delta);
    if (delta !== 0) transaction.set(ref, { count: next, expiresAt: new Date(Date.now() + 7 * 86400000) });
    return next;
  });
}
export async function access(req: VercelRequest, uid: string | null, reserve = false): Promise<{ status: Access; release: () => Promise<void> }> {
  const subscription = await revenueCat(uid);
  const paid = subscription.tier !== 'free';
  const id = paid ? '' : usageId(req, uid);
  let used = paid ? 0 : await changeUsage(id, reserve ? 1 : 0);
  let released = false;
  return { status: { ...subscription, remaining: paid ? null : Math.max(0, FREE_DAILY_ANALYSES - used), limit: paid ? null : FREE_DAILY_ANALYSES, resetAt: day().resetAt, billingReady: Boolean(process.env.REVENUECAT_API_KEY), checkoutReady: Boolean(process.env.REVENUECAT_PURCHASE_LINK && process.env.REVENUECAT_API_KEY), preview: localPreview() && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON }, release: async () => { if (!reserve || paid || released) return; released = true; used = await changeUsage(id, -1); } };
}
