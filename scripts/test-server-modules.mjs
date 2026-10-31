import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
await mkdir('.fitmacro-preview', { recursive: true });
const output = await mkdtemp(join(process.cwd(), '.fitmacro-preview', 'esm-test-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.json', '--noEmit', 'false', '--rootDir', '.', '--outDir', output], { stdio: 'pipe' });
  // Use TypeScript's actual emitted .js files in this ESM package, without a bundler.
  for (const name of ['subscription', 'analyze', 'barcode', 'blog']) {
    const source = await readFile(join(output, 'api', `${name}.js`), 'utf8');
    assert(!source.includes('Object.defineProperty(exports'), `${name} must not emit CommonJS exports`);
    const module = await import(pathToFileURL(join(output, 'api', `${name}.js`)).href);
    assert.equal(typeof module.default, 'function');
  }
  process.env.FITMACRO_LOCAL_PREVIEW = 'true';
  delete process.env.VERCEL;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.REVENUECAT_API_KEY;
  const { default: subscription } = await import(pathToFileURL(join(output, 'api/subscription.js')).href);
  const req = { method: 'GET', headers: {}, socket: { remoteAddress: 'esm-regression' } };
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
  await subscription(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.remaining, 3);
  console.log('Native ESM checks passed: emitted subscription, analysis, and blog handlers import successfully; subscription GET responds.');
} finally { await rm(output, { recursive: true, force: true }); }
