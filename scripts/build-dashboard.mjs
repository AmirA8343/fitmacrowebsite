import { build, context } from 'esbuild';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer, request } from 'node:http';
try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const serve = process.argv.includes('--serve');
const options = { entryPoints: ['dashboard/src/main.tsx'], bundle: true, outdir: 'public/dashboard/assets', entryNames: 'app', minify: !serve, sourcemap: serve, target: ['es2022'], define: { 'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production') } };
await mkdir('public/dashboard', { recursive: true });
const prerender = await build({ stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import Landing from './dashboard/src/Landing'; export function render() { return renderToStaticMarkup(React.createElement(Landing)); }`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false });
const rendering = { exports: {} };
new Function('require', 'module', 'exports', prerender.outputFiles[0].text)(createRequire(import.meta.url), rendering, rendering.exports);
const html = (await readFile('dashboard/index.html', 'utf8')).replace('<!--APP-->', rendering.exports.render());
await writeFile('public/dashboard/index.html', html);
if (serve) {
  const ctx = await context(options);
  await ctx.watch();
  const assets = await ctx.serve({ servedir: 'public', host: '127.0.0.1', port: 0 });
  process.env.FITMACRO_LOCAL_PREVIEW = 'true';
  await mkdir('.fitmacro-preview', { recursive: true });
  const temporary = await mkdtemp(join(process.cwd(), '.fitmacro-preview', 'api-'));
  await build({ entryPoints: { analyze: 'api/analyze.ts', subscription: 'api/subscription.ts' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', outdir: temporary, outExtension: { '.js': '.cjs' } });
  const handlers = {};
  for (const name of ['analyze', 'subscription']) handlers[`/api/${name}`] = (await import(pathToFileURL(join(temporary, `${name}.cjs`)).href)).default.default;
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (handlers[pathname]) {
      res.status = code => { res.statusCode = code; return res; };
      res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
      try {
        let body = ''; for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > 16384) { res.status(413).json({ error: 'Meal description is too large.' }); return; } }
        req.body = body ? JSON.parse(body) : {};
      } catch { res.status(400).json({ error: 'Invalid JSON.' }); return; }
      try { await handlers[pathname](req, res); } catch { if (!res.headersSent) res.status(500).json({ error: 'The local API could not complete this request.' }); }
      return;
    }
    const upstream = request({ host: '127.0.0.1', port: assets.port, path: pathname === '/free-ai-calorie-counter' ? '/dashboard/' : req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Preview server unavailable'); });
    req.pipe(upstream);
  });
  server.on('error', async error => { console.error(error.message); await ctx.dispose(); await rm(temporary, { recursive: true, force: true }); process.exit(1); });
  const port = Number(process.env.FITMACRO_DEV_PORT || 5173);
  server.listen(port, '127.0.0.1', () => console.log(`FitMacro dashboard: http://127.0.0.1:${port}/dashboard/ (AI API enabled)`));
  const shutdown = async () => { server.close(); await ctx.dispose(); await rm(temporary, { recursive: true, force: true }); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} else { await build(options); console.log('Built React dashboard in public/dashboard'); }
