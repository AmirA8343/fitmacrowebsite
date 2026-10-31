import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseEstimate } from '../dashboard/src/nutrition.js';
import { access, AccessError, identify } from '../server/billing.js';
const DEFAULT_ENDPOINT = 'https://macro-mate-backend-taupe.vercel.app/api/new_ui_copy';
const attempts = new Map<string, { count: number; until: number }>();
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST to analyze a meal.' }); }
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'Send a JSON meal description.' });
  const description = req.body?.description;
  if (typeof description !== 'string' || !description.trim() || description.length > 500) return res.status(400).json({ error: 'Enter a meal description between 1 and 500 characters.' });
  const corrections = req.body?.correctedIngredients;
  if (corrections !== undefined && (!Array.isArray(corrections) || corrections.length < 1 || corrections.length > 40 || !corrections.every((item: any) => item && typeof item.name === 'string' && item.name.trim() && item.name.length <= 150 && typeof item.unit === 'string' && item.unit.length <= 40 && [item.quantity, item.weight_g].every(n => n === null || (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100000))))) return res.status(400).json({ error: 'Please check the ingredient names and amounts.' });
  const correctedIngredients = corrections?.map((item: any) => ({ name: item.name.trim(), quantity: item.quantity, unit: item.unit.trim(), weight_g: item.weight_g }));
  // Best-effort burst protection per running instance, not a subscription quota.
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const ip = String(req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? 'unknown');
  const limit = attempts.get(ip) ?? { count: 0, until: now + 60_000 };
  if (limit.count >= 10) { res.setHeader('Retry-After', String(Math.ceil((limit.until - now) / 1000))); return res.status(429).json({ error: 'Too many analyses. Please wait a minute and try again.' }); }
  limit.count++; attempts.set(ip, limit);
  let reservation: Awaited<ReturnType<typeof access>>;
  try { reservation = await access(req, await identify(req), true); }
  catch (err) { return res.status(err instanceof AccessError ? err.status : 503).json({ error: err instanceof AccessError ? err.message : 'Daily allowance could not be checked. Please try again.', code: err instanceof AccessError ? err.code : 'unavailable' }); }
  let successful = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const endpoint = new URL(process.env.FITMACRO_NUTRITION_ENDPOINT || DEFAULT_ENDPOINT);
    if (endpoint.protocol !== 'https:') return res.status(503).json({ error: 'The nutrition service is not configured correctly.' });
    const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: description.trim(), language: 'en', ...(correctedIngredients ? { correctedIngredients } : {}) }), signal: controller.signal });
    if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({ error: upstream.status === 429 ? 'The nutrition service is busy. Please try again shortly.' : 'The nutrition service could not analyze this meal. Please try again or use manual entry.' });
    const estimate = parseEstimate(await upstream.json());
    successful = true;
    return res.status(200).json({ ...estimate.nutrition, ai_summary: estimate.summary, ...(estimate.title ? { ui_title: estimate.title } : {}), ...(estimate.subtitle ? { ui_subtitle: estimate.subtitle } : {}), ...(estimate.foods ? { ai_foods: estimate.foods } : {}) });
  } catch (error) {
    if (controller.signal.aborted) return res.status(504).json({ error: 'Analysis took too long. Please try again or use manual entry.' });
    return res.status(502).json({ error: error instanceof Error && error.message.startsWith('No usable nutrition') ? error.message : 'Couldn’t get a nutrition estimate. Please try again or enter the numbers manually.' });
  } finally { clearTimeout(timeout); if (!successful) await reservation.release().catch(() => {}); }
}
