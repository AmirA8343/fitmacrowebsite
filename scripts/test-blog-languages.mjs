import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../api/blog.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
const article = { slug: "english-guide", title: "English guide", description: "An English guide", body: "## English\n\nEnglish content", published_at: "2026-10-22T12:00:00Z", translations: {
  es: { slug: "guia-espanola", title: "Guía española", description: "Guía en español", body: "## Español\n\nContenido español" },
  fr: { slug: "guide-francais", title: "Guide français", description: "Guide en français", body: "## Français\n\nContenu français" }
} };
let articles = [article];
const mockFetch = async () => new Response(JSON.stringify({ site: { origin: "https://www.fitmacro.ca" }, articles }), { headers: { "Content-Type": "application/json" } });
const module = { exports: {} };
new Function("require", "module", "exports", "fetch", compiled)(require, module, module.exports, mockFetch);
const handler = module.exports.default;
const previousUrl = process.env.FITADENGINE_CONTENT_URL;
const previousToken = process.env.FITADENGINE_CONTENT_TOKEN;
process.env.FITADENGINE_CONTENT_URL = "https://feed.test";
process.env.FITADENGINE_CONTENT_TOKEN = "test-token";
async function request(query, method = "GET") {
  const result = { code: 0, headers: {}, body: "", status(code) { this.code = code; return this; }, setHeader(name, value) { this.headers[name] = value; return this; }, send(body) { this.body = body; return this; }, end() { return this; } };
  await handler({ method, query }, result);
  return result;
}
try {
  for (const [locale, slug, title] of [["en", article.slug, article.title], ["es", article.translations.es.slug, article.translations.es.title], ["fr", article.translations.fr.slug, article.translations.fr.title]]) {
    const result = await request({ locale, slug });
    assert.equal(result.code, 200);
    assert.ok(result.body.includes(`<html lang="${locale}">`));
    assert.ok(result.body.includes(title));
    assert.match(result.body, /aria-label="(?:Article language|Idioma del artículo|Langue de l’article)"/);
    for (const url of ["/blog/english-guide", "/es/blog/guia-espanola", "/fr/blog/guide-francais"]) assert.ok(result.body.includes(`href="https://www.fitmacro.ca${url}"`));
    assert.match(result.body, new RegExp(`hrefLang="${locale}"[^>]*lang="${locale}"[^>]*aria-current="page"`, "i"));
    const listing = await request({ locale });
    assert.ok(listing.body.includes(`/blog/${slug}`));
    assert.ok(listing.body.includes(`href="https://www.fitmacro.ca/fr/blog"`));
  }
  const sitemap = await request({ format: "sitemap" });
  for (const url of ["/blog", "/es/blog", "/fr/blog", "/blog/english-guide", "/es/blog/guia-espanola", "/fr/blog/guide-francais"]) assert.ok(sitemap.body.includes(`<loc>https://www.fitmacro.ca${url}</loc>`));
  const head = await request({ locale: "fr", slug: "guide-francais" }, "HEAD");
  assert.equal(head.code, 200);
  assert.equal(head.body, "");
  articles = [{ ...article, translations: {} }];
  const englishOnly = await request({ locale: "en", slug: article.slug });
  assert.equal(englishOnly.code, 200);
  assert.ok(!englishOnly.body.includes('hrefLang="fr"'));
  assert.ok(!englishOnly.body.includes('hrefLang="es"'));
  assert.equal((await request({ locale: "fr", slug: article.slug })).code, 404);
  assert.equal((await request({ locale: "en", slug: "../../secret" })).code, 404);
  console.log("Blog language checks passed: localized links, current language, listings, sitemap, missing translations, HEAD, and existing English URLs.");
} finally {
  if (previousUrl === undefined) delete process.env.FITADENGINE_CONTENT_URL; else process.env.FITADENGINE_CONTENT_URL = previousUrl;
  if (previousToken === undefined) delete process.env.FITADENGINE_CONTENT_TOKEN; else process.env.FITADENGINE_CONTENT_TOKEN = previousToken;
}
