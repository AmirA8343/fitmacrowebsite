import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function inventory(directory) {
  const found = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) for (const [name, bytes] of await inventory(path)) found.set(name, bytes);
    else found.set(path, await readFile(path));
  }
  return found;
}
const before = await inventory('public/blog');
assert(before.size > 0, 'Expected the published GitHub article fixture');
execFileSync(process.execPath, ['scripts/verify-blog.mjs'], { stdio: 'inherit' });
const after = await inventory('public/blog');
assert.deepEqual(after, before, 'Build preparation must preserve every published article and stylesheet byte-for-byte');
console.log('Published article HTML and styles survive build preparation.');
