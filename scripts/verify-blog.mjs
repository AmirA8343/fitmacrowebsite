import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { extname } from "node:path";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const required = ["/blog", "/blog/sitemap.xml", "/blog/:slug", "/es/blog", "/es/blog/:slug", "/fr/blog", "/fr/blog/:slug"];
for (const route of required) if (!config.rewrites.some((item) => item.source === route)) throw new Error(`Missing blog route: ${route}`);

const root = new URL("../", import.meta.url);
const output = new URL("../public/", import.meta.url);
const staticExtensions = new Set([".html", ".xml", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".webmanifest"]);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && staticExtensions.has(extname(entry.name).toLowerCase())) await cp(new URL(entry.name, root), new URL(entry.name, output));
  if (entry.isDirectory() && ["delete-data", "links"].includes(entry.name)) await cp(new URL(`${entry.name}/`, root), new URL(`${entry.name}/`, output), { recursive: true });
}

const outputFiles = await readdir(output);
if (!outputFiles.includes("index.html") || !outputFiles.includes("robots.txt") || !outputFiles.includes("sitemap.xml")) throw new Error("Static output is incomplete.");
console.log(`FitMacro legacy pages copied to public (${outputFiles.length} top-level entries); multilingual blog routes verified.`);
