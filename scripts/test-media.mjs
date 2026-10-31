import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
process.env.FITMACRO_LOCAL_PREVIEW = 'true';
async function moduleFrom(path) { const output = await build({ entryPoints:[path], bundle:true, packages:'external',write:false,platform:'node',format:'cjs' }); const module = { exports:{} }; new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports); return module.exports; }
const { validImage } = await moduleFrom('server/meal-image.ts');
const photo = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(150)]).toString('base64');
assert(validImage(photo));
for (const invalid of ['https://example.com/image.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,'+Buffer.alloc(200).toString('base64'), photo+'a'.repeat(2800000)]) assert(!validImage(invalid));
const { default: analyze } = await moduleFrom('api/analyze.ts');
const { default: barcode } = await moduleFrom('api/barcode.ts');
async function invoke(handler,body,ip='photo-test') { const req = { method:'POST', headers:{'content-type':'application/json'},socket:{remoteAddress:ip},body }; const res = { statusCode:200, headers:{}, setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;} }; await handler(req,res);return res; }
const originalFetch = globalThis.fetch;
try {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await invoke(analyze,{image:'https://example.com/photo'})).statusCode,400);
  let count=0;
  globalThis.fetch = async (url,options) => { count++; assert.equal(url.toString(),'https://macro-mate-backend-taupe.vercel.app/api/nutrition'); const body=JSON.parse(options.body); assert.equal(body.photoUrl,photo); assert.equal(body.description,''); assert(!options.headers.Authorization); return Response.json({calories:200,protein:10,carbs:20,fat:8,ui_title:'Meal'}); };
  for(let i=0;i<3;i++) assert.equal((await invoke(analyze,{image:photo})).statusCode,200);
  assert.equal((await invoke(analyze,{image:photo})).statusCode,429); assert.equal(count,3);
  globalThis.fetch = async () => Response.json({error:'private provider details'},{status:500});
  assert.equal((await invoke(analyze,{image:photo},'refund-photo')).statusCode,502);
  globalThis.fetch = async () => Response.json({calories:200,protein:10,carbs:20,fat:8});
  for(let i=0;i<3;i++) assert.equal((await invoke(analyze,{image:photo},'refund-photo')).statusCode,200);
  globalThis.fetch = async () => { throw new Error('Must not fetch invalid barcode'); };
  assert.equal((await invoke(barcode,{barcode:'../../bad'})).statusCode,400);
  globalThis.fetch = async (url,options) => { assert(new URL(url).hostname === 'world.openfoodfacts.org'); assert(options.headers['User-Agent'].includes('FitMacro')); return Response.json({status:1,product:{product_name:'Oats',brands:'Sample',nutriments:{'energy-kcal_100g':380,proteins_100g:13,carbohydrates_100g:60,fat_100g:7}}}); };
  const product = await invoke(barcode,{barcode:'1234567890123'}); assert.equal(product.body.product.baseAmount,100); assert.equal(product.body.estimate.nutrition.calories,380);
  globalThis.fetch = async () => Response.json({status:0}); assert.equal((await invoke(barcode,{barcode:'1234567890123'})).statusCode,404);
  globalThis.fetch = async () => Response.json({status:1,product:{product_name:'Unknown',nutriments:{}}}); assert.equal((await invoke(barcode,{barcode:'1234567890123'})).statusCode,422);
  console.log('Media checks passed: bounded JPEG input, no remote-image fetching, existing mobile image route without a website OpenAI key, quota enforcement/refunds, barcode validation and missing nutrition.');
} finally { globalThis.fetch=originalFetch; delete process.env.OPENAI_API_KEY; }
