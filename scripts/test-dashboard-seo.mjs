import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { seoHead } from './dashboard-seo.mjs';
const bundle=await build({entryPoints:['dashboard/src/seo.ts'],bundle:true,platform:'node',format:'cjs',write:false});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {seoPages,siteOrigin}=module.exports;
const sitemap=await readFile('public/sitemap.xml','utf8');
const titles=new Set();
for (const [language,page] of Object.entries(seoPages)) {
 const html=await readFile(`public${page.path}.html`,'utf8');
 assert(html.includes(`<html lang="${language}">`));
 assert(html.includes(`<title>${page.title.replaceAll('&','&amp;')}</title>`));
 titles.add(page.title);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert(html.includes(`rel="canonical" href="${siteOrigin}${page.path}"`));
 assert.equal((html.match(/<h1>/g)||[]).length,1);
 assert(!html.includes('<!--APP-->'));assert(!html.includes('<!--SEO-->'));
 for (const [alternate,other] of Object.entries(seoPages)) {
  assert(html.includes(`hreflang="${alternate}" href="${siteOrigin}${other.path}"`));
  assert(html.includes(`href="${other.path}"`),'Language links must exist in initial HTML');
 }
 assert(html.includes('hreflang="x-default"'));
 assert(html.includes(`property="og:locale" content="${page.locale}"`));
 const structured=JSON.parse(html.match(/<script type="application\/ld\+json" data-fitmacro-schema>([\s\S]*?)<\/script>/)[1]);
 assert.equal(structured.inLanguage,language);assert.equal(structured.url,siteOrigin+page.path);
 assert.equal(structured.description,page.description);assert(!structured.aggregateRating);
 assert(sitemap.includes(`<loc>${siteOrigin}${page.path}</loc>`));
 assert(seoHead(language,seoPages,siteOrigin,{noindex:true}).includes('content="noindex,follow"'));
 if(language!=='en'){assert(!html.includes('Know your meal.'));assert(!html.includes('What did you eat?'));}
}
assert.equal(titles.size,4);
assert((await readFile('public/dashboard/index.html','utf8')).includes('content="noindex,follow"'));
const config=JSON.parse(await readFile('vercel.json','utf8'));
assert(!config.rewrites.some(route=>Object.values(seoPages).some(page=>page.path===route.source)),'Public localized HTML must not be rewritten to English');
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);assert.equal(new Set(urls).size,urls.length);
console.log('SEO checks passed: four translated HTML pages, unique titles, self-canonicals, reciprocal hreflang, crawlable language links, schema, sitemap, and noindex for preview/private dashboard.');
