import assert from "node:assert/strict";
import { build } from "@vercel/node";
import { glob, FileBlob } from "@vercel/build-utils";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
const workPath = process.cwd();
const config = JSON.parse(await readFile("vercel.json", "utf8"));
const files = await glob("{api/**,package.json,package-lock.json,tsconfig.json}", workPath);
const { output } = await build({ files, entrypoint: "api/blog.tsx", workPath,
  meta: { isDev: true }, config: { zeroConfig: true, ...config.functions["api/blog.tsx"] } });
assert(output.files["package.json"], "Blog bundle must include its ESM package declaration");
await mkdir(".fitmacro-preview", { recursive: true });
const directory = await mkdtemp(join(workPath, ".fitmacro-preview/blog-bundle-"));
try {
  // Exercise Vercel's packaged output rather than only TypeScript's emitted files.
  for (const [name, file] of Object.entries(output.files)) {
    if (name.startsWith("node_modules/")) continue;
    const { data } = await FileBlob.fromStream({ stream: file.toStream() });
    const target = join(directory, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  const { default: handler } = await import(pathToFileURL(join(directory, output.handler)).href);
  assert.equal(typeof handler, "function");
  const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, end() {} };
  await handler({ method: "POST" }, response);
  assert.equal(response.statusCode, 405);
  console.log("Vercel blog bundle imports and responds with its packaged ESM declaration.");
} finally { await rm(directory, { recursive: true, force: true }); }
