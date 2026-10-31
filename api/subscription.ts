import type { VercelRequest, VercelResponse } from '@vercel/node';
import { access, AccessError, checkoutUrl, identify, revenueCat } from '../server/billing.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
    const uid = await identify(req);
    if (req.method === 'GET') return res.status(200).json((await access(req, uid)).status);
    if (!uid) throw new AccessError(401, 'Sign in before subscribing so your purchase works on web, iOS, and Android.', 'sign_in');
    if (!process.env.REVENUECAT_API_KEY) throw new AccessError(503, 'Web subscriptions are being prepared.', 'checkout_unavailable');
    if ((await revenueCat(uid)).tier !== 'free') throw new AccessError(409, 'Your account already has a subscription. Refresh your access instead of buying again.', 'already_subscribed');
    return res.status(200).json({ url: checkoutUrl(uid) });
  } catch (err) { return res.status(err instanceof AccessError ? err.status : 503).json({ error: err instanceof AccessError ? err.message : 'Subscription service is unavailable. Please try again.', code: err instanceof AccessError ? err.code : 'unavailable' }); }
}
