# FitMacro web tracker indexing review — November 5, 2026

## Production findings

All four public tracker URLs returned HTTP 200 when fetched directly:

| Language | URL |
| --- | --- |
| English | https://www.fitmacro.ca/free-ai-calorie-counter |
| Spanish | https://www.fitmacro.ca/es/contador-calorias-ia-gratis |
| French | https://www.fitmacro.ca/fr/compteur-calories-ia-gratuit |
| German | https://www.fitmacro.ca/de/kostenloser-ki-kalorienzaehler |

The live pages already contain translated, prerendered HTML, self-referencing canonicals, reciprocal hreflang links for all four languages and x-default, and index/follow directives. The localized URLs are listed in the sitemap. robots.txt allows public pages and advertises the sitemaps. There was no demonstrated technical indexing block in these checks.

Search Console's **Live Test → URL is available to Google** means the page is accessible and eligible; it does not establish that Google has indexed it. The **Google Index** tab is needed to verify indexing and Google's selected canonical for each URL. Public fetches cannot establish those private Search Console results.

## Changes prepared in this checkout

- Added direct HTML links to every language from the company homepage, app directory, FitMacro overview, and macro tracker guide. Previously the homepage linked only to the English tracker and the other three discovery pages did not link to the tracker.
- Added fully translated guidance on portions, preparation, reviewing estimates, and browser storage. Each page includes a localized meal example that fills the actual form. This provides useful content beyond the existing product introduction.
- Updated the four tracker sitemap modification dates to the content-change date. Keep these dates tied to meaningful content changes rather than updating them on every build.
- Extended the existing SEO checks to verify the translated guides and direct links from discovery pages.

These changes require deployment through the project's existing Vercel workflow to affect production. No deployment or Search Console submission was performed during this review.

## After deployment

1. Submit or resubmit `https://www.fitmacro.ca/sitemap.xml` in Search Console.
2. Inspect each of the four URLs. Check the Google Index tab, indexing reason, last crawl, and Google-selected canonical. Every language should normally select its own URL.
3. Run the live test and request indexing once for each updated URL. Repeated requests do not accelerate crawling.
4. Track the four URLs separately in Search Console's Pages and Performance reports. If a page remains excluded, use its actual exclusion reason to decide the next change.
5. Add contextual tracker links from genuinely relevant nutrition articles as they are published, using the matching language. The blog currently supports English, Spanish, and French; do not invent German blog URLs. Useful original content and relevant external mentions are longer-term opportunities, not technical guarantees of indexing.

Adding more schema, repeating keywords, or duplicating hreflang in the sitemap is not a substitute for useful pages and discovery. Existing WebApplication markup does not guarantee a rich result; the lack of an enhancement in Search Console is not an indexing failure.

## Google references

- [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions): reciprocal annotations, translated main content, and language targeting.
- [Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable): real anchors with hrefs and descriptive link text.
- [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): prerendering and consistent canonical metadata.
- [Request recrawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl): requests do not guarantee indexing; repeated requests do not speed crawling.
