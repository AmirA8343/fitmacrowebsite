import type { VercelRequest, VercelResponse } from "@vercel/node";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

type Locale = "en" | "es" | "fr";
type Translation = { slug: string; title: string; description: string; body: string };
type Article = Translation & { published_at: string; translations?: Partial<Record<"es" | "fr", Translation>> };

const origin = "https://www.fitmacro.ca";
const ios = "https://apps.apple.com/us/app/fitmacro-ai-calorie-counter/id6753078641";
const android = "https://play.google.com/store/apps/details?id=com.fitmacrotechnologies.fitmacro";
const labels = {
  en: { articles: "Articles", heading: "FitMacro guides", intro: "Practical nutrition, calorie tracking and healthy habit guides.", all: "All articles", download: "Track your nutrition with FitMacro", ios: "Download for iPhone", android: "Get it on Android", empty: "No articles have been published yet." },
  es: { articles: "Artículos", heading: "Guías de FitMacro", intro: "Guías prácticas de nutrición, seguimiento de calorías y hábitos saludables.", all: "Todos los artículos", download: "Registra tu nutrición con FitMacro", ios: "Descargar para iPhone", android: "Obtener para Android", empty: "Todavía no hay artículos publicados." },
  fr: { articles: "Articles", heading: "Guides FitMacro", intro: "Des guides pratiques sur la nutrition, le suivi des calories et les habitudes saines.", all: "Tous les articles", download: "Suivez votre nutrition avec FitMacro", ios: "Télécharger pour iPhone", android: "Obtenir sur Android", empty: "Aucun article n’a encore été publié." }
} as const;

function path(locale: Locale, slug = "") { return `${locale === "en" ? "" : `/${locale}`}/blog${slug ? `/${slug}` : ""}`; }
function localized(article: Article, locale: Locale): Translation | null { return locale === "en" ? article : article.translations?.[locale] ?? null; }

function ArticleBody({ body }: { body: string }) {
  return <>{body.split(/\n\s*\n/).map((block, index) => {
    const lines = block.trim().split("\n");
    if (/^### /.test(lines[0])) return <h3 key={index}>{lines[0].slice(4)}</h3>;
    if (/^## /.test(lines[0])) return <h2 key={index}>{lines[0].slice(3)}</h2>;
    if (lines.every((line) => line.startsWith("- "))) return <ul key={index}>{lines.map((line, item) => <li key={item}>{line.slice(2)}</li>)}</ul>;
    return <p key={index}>{lines.map((line, item) => <React.Fragment key={item}>{item > 0 && <br />}{line}</React.Fragment>)}</p>;
  })}</>;
}

function DownloadCard({ locale }: { locale: Locale }) {
  const copy = labels[locale];
  return <aside className="download"><strong>{copy.download}</strong><div><a href={ios} rel="noopener"> {copy.ios}</a><a href={android} rel="noopener">▶ {copy.android}</a></div></aside>;
}

function Page({ locale, title, description, canonical, alternates, children }: React.PropsWithChildren<{ locale: Locale; title: string; description: string; canonical: string; alternates?: Partial<Record<Locale, string>> }>) {
  const copy = labels[locale];
  return <html lang={locale}><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{title}</title><meta name="description" content={description}/><link rel="canonical" href={canonical}/>{alternates && (Object.entries(alternates) as [Locale,string][]).map(([lang,url]) => <link key={lang} rel="alternate" hrefLang={lang} href={url}/>)}<meta property="og:title" content={title}/><meta property="og:description" content={description}/><meta property="og:url" content={canonical}/><style>{css}</style></head><body><header><a className="brand" href={origin}>FitMacro</a><nav><a href={path(locale)}>{copy.articles}</a><a href="/apps">Apps</a></nav></header><main>{children}</main><footer>© FitMacro Technologies · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></footer></body></html>;
}

const css = `:root{color-scheme:dark;--bg:#071017;--panel:#0d1b25;--ink:#f4f7f8;--muted:#a8b5bd;--green:#2de0a7;--line:#20323e}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#123c3a 0,transparent 34rem),var(--bg);color:var(--ink);font:17px/1.75 Inter,system-ui,sans-serif}header,main,footer{width:min(100% - 40px,980px);margin:auto}header{height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}nav{display:flex;gap:24px}.brand{font-size:24px;font-weight:900}a{color:var(--green);text-underline-offset:4px}main{min-height:70vh;padding:64px 0}h1{max-width:800px;font-size:clamp(36px,7vw,64px);line-height:1.05;letter-spacing:-.045em;margin:0 0 24px}h2{font-size:30px;margin-top:2em;line-height:1.25}h3{font-size:23px;margin-top:1.8em}.intro{font-size:20px;color:var(--muted);max-width:760px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:44px}.card,.download{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:28px}.card h2{margin:0;font-size:26px}.card h2 a{color:var(--ink);text-decoration:none}.card p,time{color:var(--muted)}article{max-width:800px}.download{margin-top:56px}.download strong{display:block;font-size:24px}.download div{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px}.download a{background:var(--green);color:#06100d;text-decoration:none;font-weight:800;padding:11px 16px;border-radius:10px}footer{border-top:1px solid var(--line);padding:28px 0 40px;color:var(--muted)}@media(max-width:680px){header{height:74px}.grid{grid-template-columns:1fr}main{padding:42px 0}.download div{flex-direction:column}.download a{text-align:center}}`;

function html(node: React.ReactElement) { return `<!doctype html>${renderToStaticMarkup(node)}`; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).end();
  const locale = (["en", "es", "fr"].includes(String(req.query.locale)) ? req.query.locale : "en") as Locale;
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return res.status(404).end();
  const endpoint = process.env.FITADENGINE_CONTENT_URL;
  const token = process.env.FITADENGINE_CONTENT_TOKEN;
  if (!endpoint || !token) return res.status(503).setHeader("X-Robots-Tag", "noindex").send("Blog connection is not configured.");
  try {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("content feed unavailable");
    const payload = await response.json() as { site: { origin: string }; articles: Article[] };
    if (payload.site?.origin !== origin || !Array.isArray(payload.articles)) throw new Error("content feed mismatch");
    const published = payload.articles.filter((item) => item.published_at);
    if (req.query.format === "sitemap") {
      const urls = published.flatMap((article) => (["en", "es", "fr"] as Locale[]).flatMap((language) => { const content = localized(article, language); return content ? [`${origin}${path(language, content.slug)}`] : []; }));
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/blog</loc></url>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
      return res.status(200).setHeader("Content-Type", "application/xml; charset=utf-8").send(req.method === "HEAD" ? "" : xml);
    }
    const copy = labels[locale];
    if (!slug) {
      const cards = published.flatMap((article) => { const content = localized(article, locale); return content ? [{ article, content }] : []; });
      const canonical = `${origin}${path(locale)}`;
      const body = <Page locale={locale} title={`${copy.heading} | FitMacro`} description={copy.intro} canonical={canonical}><h1>{copy.heading}</h1><p className="intro">{copy.intro}</p><section className="grid">{cards.length ? cards.map(({ article, content }) => <article className="card" key={content.slug}><h2><a href={path(locale, content.slug)}>{content.title}</a></h2><p>{content.description}</p><time>{new Date(article.published_at).toLocaleDateString(locale, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" })}</time></article>) : <p>{copy.empty}</p>}</section></Page>;
      if (!cards.length) res.setHeader("X-Robots-Tag", "noindex");
      return res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(req.method === "HEAD" ? "" : html(body));
    }
    const match = published.find((article) => localized(article, locale)?.slug === slug);
    const content = match && localized(match, locale);
    if (!match || !content) return res.status(404).setHeader("X-Robots-Tag", "noindex").send("Article not found");
    const alternates = Object.fromEntries((["en", "es", "fr"] as Locale[]).flatMap((language) => { const item = localized(match, language); return item ? [[language, `${origin}${path(language, item.slug)}`]] : []; })) as Partial<Record<Locale,string>>;
    const canonical = `${origin}${path(locale, content.slug)}`;
    const body = <Page locale={locale} title={`${content.title} | FitMacro`} description={content.description} canonical={canonical} alternates={alternates}><article><p><a href={path(locale)}>← {copy.all}</a></p><h1>{content.title}</h1><p className="intro">{content.description}</p><time>{new Date(match.published_at).toLocaleDateString(locale, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" })}</time><ArticleBody body={content.body}/><DownloadCard locale={locale}/></article></Page>;
    return res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(req.method === "HEAD" ? "" : html(body));
  } catch { return res.status(503).setHeader("X-Robots-Tag", "noindex").send("Articles are temporarily unavailable."); }
}
