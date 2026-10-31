import { build } from 'esbuild';
import { createRequire } from 'node:module';
// Render every result variant without network calls or uploading images.
const output = await build({ stdin: { contents: `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import MealResult from './dashboard/src/MealResult';
const props = { initial: { nutrition: { calories: 150, protein: 12, carbs: 2, fat: 10 }, summary: 'Two eggs', title: 'Boiled eggs', foods: [{ name: 'egg', quantity: 2, unit: 'piece', display: '2 eggs' }] }, description: '2 boiled eggs', date: '2026-10-30', save() {}, back() {} };
const text = renderToStaticMarkup(React.createElement(MealResult, props));
assert(text.includes('Nutrition snapshot')); assert(text.includes('2 eggs')); assert(text.includes('Log Meal')); assert(text.includes('name="calories" value="150"')); assert(!text.includes('type="number"')); // Results are presented as cards by default.
const photo = renderToStaticMarkup(React.createElement(MealResult, { ...props, source: 'photo', imageUrl: 'blob:local-preview' }));
assert(photo.includes('alt="Analyzed meal"')); assert(photo.includes('Photo')); assert(photo.includes('Ingredients'));
const barcode = renderToStaticMarkup(React.createElement(MealResult, { ...props, source: 'barcode', product: { brand: 'Sample', barcode: '1234567890123', servingSize: '100 g', baseAmount: 100, baseUnit: 'g' } }));
assert(barcode.includes('Barcode Result')); assert(barcode.includes('Base serving: 100 g')); assert(barcode.includes('Calculate')); assert(barcode.includes('type="submit" disabled=""')); assert(barcode.includes('Scan again'));
console.log('Result checks passed: text, local photo layout, barcode portion requirements, and card-first presentation.');
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} };
new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
