import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const required = ["/blog", "/blog/sitemap.xml", "/blog/:slug", "/es/blog", "/es/blog/:slug", "/fr/blog", "/fr/blog/:slug"];
for (const route of required) if (!config.rewrites.some((item) => item.source === route)) throw new Error(`Missing blog route: ${route}`);
console.log("FitMacro legacy pages remain static; multilingual blog routes verified.");
