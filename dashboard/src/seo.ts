export type Language = 'en' | 'es' | 'fr' | 'de';
export const siteOrigin = 'https://www.fitmacro.ca';
export const seoPages: Record<Language, { path: string; title: string; description: string; locale: string }> = {
  en: {
    path: '/free-ai-calorie-counter',
    title: 'Free AI Calorie Counter & Food Tracker | FitMacro',
    description: 'Track calories and macros from meal photos or text. Get 3 free AI analyses daily, plus unlimited manual logging. Try FitMacro online without an account.',
    locale: 'en_CA',
  },
  es: {
    path: '/es/contador-calorias-ia-gratis',
    title: 'Contador de calorías con IA gratis | FitMacro',
    description: 'Cuenta calorías y macros con fotos o texto. Obtén 3 análisis con IA gratis al día y registro manual ilimitado. Prueba FitMacro en línea sin crear una cuenta.',
    locale: 'es_ES',
  },
  fr: {
    path: '/fr/compteur-calories-ia-gratuit',
    title: 'Compteur de calories IA gratuit en ligne | FitMacro',
    description: 'Suivez calories et macros par photo ou texte. Profitez de 3 analyses IA gratuites par jour et de la saisie manuelle illimitée. Essayez FitMacro sans compte.',
    locale: 'fr_CA',
  },
  de: {
    path: '/de/kostenloser-ki-kalorienzaehler',
    title: 'Kostenloser KI-Kalorienzähler online | FitMacro',
    description: 'Erfasse Kalorien und Makros per Foto oder Text. Täglich 3 kostenlose KI-Analysen und unbegrenzte manuelle Einträge. FitMacro online ohne Konto ausprobieren.',
    locale: 'de_DE',
  },
};
export function languageForPath(pathname: string): Language | undefined {
  const path = pathname.replace(/\/$/, '');
  return (Object.keys(seoPages) as Language[]).find(language => seoPages[language].path === path);
}
export function syncPageMetadata(language: Language) {
  const page = seoPages[language];
  document.documentElement.lang = language;
  document.title = page.title;
  const set = (selector: string, attr: string, value: string) => document.querySelector(selector)?.setAttribute(attr,value);
  set('meta[name="description"]','content',page.description);
  set('link[rel="canonical"]','href',siteOrigin + page.path);
  set('meta[property="og:title"]','content',page.title);
  set('meta[property="og:description"]','content',page.description);
  set('meta[property="og:url"]','content',siteOrigin + page.path);
  set('meta[property="og:locale"]','content',page.locale);
  set('meta[name="twitter:title"]','content',page.title);
  set('meta[name="twitter:description"]','content',page.description);
  document.querySelectorAll('meta[property="og:locale:alternate"]').forEach(element => element.remove());
  for (const [alternate,other] of Object.entries(seoPages)) if (alternate !== language) { const meta = document.createElement('meta'); meta.setAttribute('property','og:locale:alternate'); meta.content = other.locale; document.head.appendChild(meta); }
  const structured = document.querySelector('script[data-fitmacro-schema]');
  if (structured?.textContent) {
    const data = JSON.parse(structured.textContent);
    data.name = page.title.replace(' | FitMacro',''); data.description = page.description; data.inLanguage = language; data.url = siteOrigin + page.path;
    structured.textContent = JSON.stringify(data).replace(/</g,'\\u003c');
  }
}
