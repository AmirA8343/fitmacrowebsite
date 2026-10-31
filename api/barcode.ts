import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isNutrition } from '../dashboard/src/model.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST.' }); }
  const code = req.body?.barcode;
  if (typeof code !== 'string' || !/^(?:\d{8}|\d{12,14})$/.test(code)) return res.status(400).json({ error: 'Enter an 8, 12, 13, or 14 digit food barcode.' });
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_size,nutrition_data_per`, { headers: { 'User-Agent': 'FitMacroWeb/1.0 (https://fitmacro.ca)' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) return res.status(502).json({ error: 'Product lookup is busy. Try again shortly.' });
    const data = await response.json(); const p = data.product; const n = p?.nutriments;
    if (data.status !== 1 || !p?.product_name || !n) return res.status(404).json({ error: 'Product not found. Try text, a meal photo, or manual nutrition entry.' });
    const calories = n['energy-kcal_100g'] ?? (typeof n.energy_100g === 'number' ? n.energy_100g / 4.184 : undefined);
    const nutrition = { calories, protein: n.proteins_100g, carbs: n.carbohydrates_100g, fat: n.fat_100g };
    if (!isNutrition(nutrition)) return res.status(422).json({ error: 'This product has incomplete nutrition data. Please enter its label manually.' });
    return res.status(200).json({ estimate: { nutrition, title: p.product_name.slice(0,200), summary: 'Nutrition per 100 g from Open Food Facts. Check against the package label.' }, product: { barcode: code, brand: String(p.brands || '').slice(0,200), servingSize: '100 g', baseAmount: 100, baseUnit: 'g', servingUnitHuman: 'g' } });
  } catch { return res.status(502).json({ error: 'Product lookup is unavailable. Try again or use manual entry.' }); }
}
