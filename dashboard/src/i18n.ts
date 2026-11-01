import catalogs from './translations.js';
import { languageForPath, seoPages, type Language } from './seo.js';
export type { Language } from './seo.js';
export const languages: Record<Language, string> = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch' };
export function isLanguage(value: unknown): value is Language { return typeof value === 'string' && Object.hasOwn(languages, value); }
function initialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const pathLanguage = languageForPath(window.location.pathname);
  if (pathLanguage) return pathLanguage;
  const query = new URLSearchParams(window.location.search).get('lang');
  if (isLanguage(query)) return query;
  try { const saved = localStorage.getItem('fitmacro.web.language'); if (isLanguage(saved)) return saved; } catch { /* Preference storage is optional. */ }
  const browser = navigator.language?.split('-')[0]; return isLanguage(browser) ? browser : 'en';
}
let language: Language = initialLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const subscribeLanguage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setLanguage(next: Language) {
  language = next;
  try { localStorage.setItem('fitmacro.web.language', next); } catch { /* Still works without persistence. */ }
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (languageForPath(url.pathname)) {
      url.pathname = seoPages[next].path; url.searchParams.delete('lang'); window.history.replaceState(null, '', url);
    } else if (url.searchParams.has('lang')) { url.searchParams.set('lang', next); window.history.replaceState(null, '', url); }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}
export function translate(key: string, lang: Language, values: Record<string, string | number> = {}): string {
  const template = lang === 'en' ? key : (catalogs[lang] as Record<string,string>)[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values,name) ? String(values[name]) : match);
}
export const t = (key: string, values: Record<string, string | number> = {}) => translate(key, language, values);
