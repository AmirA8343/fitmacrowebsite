# FitMacro React dashboard

A React + TypeScript conversion of `FitMacro_Dashboard 2.html`. The original file is retained as a design reference. Dark blue styling adapts from a phone layout to two columns on desktop. Meal prep, meal plans, and fitness are excluded.

## Run locally

From the repository root:

```sh
npm install
npm run dev:dashboard
```

Open http://127.0.0.1:5173/dashboard/. Source changes rebuild automatically; refresh the browser to see them.

```sh
npm run build
npm run test:dashboard
```

The existing website build still copies its pages to `public/`, then builds the dashboard into `public/dashboard/`. No deployment or DNS changes are made by these commands. The dashboard can later be hosted separately at `app.fitmacro.ca`; the current build serves it at `/dashboard/`.

## Working features

- Optional Firebase sign-in (email/password, Google, Apple), sign-up, password reset, and guest access
- Two-step profile setup and calorie/macro estimates using the mobile calculations
- Daily calories, protein, carbs, fat, progress rings, and remaining targets
- Manual meal logging with numeric validation; edit and delete meals
- Mobile-style history with daily/weekly/monthly periods, snapshots, trends, editable meal cards, and reusable favorites
- Nutrition settings, browser persistence, and JSON backup export
- Native accessible dialogs with keyboard focus and Escape support

Web logs and profiles stay in this browser. Signed-in users have separate local records keyed by Firebase UID; guest records retain the original storage key. Login does not upload or merge guest data. Passwords are handled by Firebase Authentication and are never stored in meal/profile records. AI coach, scanning, and photo analysis are explicitly unconnected. Text analysis uses the existing mobile nutrition backend; no simulated estimates are saved.

## Mobile Log Meal design

The web Log Meal card uses the dashboard’s dark palette and follows the mobile `app/log-meal.tsx` screen: dark Quick Capture card, Text/Scan primary row, compact Camera/Photos row, description shell, and Cancel/Add Meal actions. Scan opens the browser camera decoder with numeric entry fallback. Camera captures a meal; Photos selects a file. New meals use text analysis first, followed by an editable nutrition review. Manual entry remains available; editing saved meals does not call AI.

## Mobile integration findings

Inspected `/Users/amir/Development/fitmacro-health-backup-20260128-214803` read-only. Its `lib/mealStorage.ts` saves individual meals in AsyncStorage under per-user, per-day keys. It uploads daily totals to `users/{uid}/dailyTotals/{date}` and ecosystem summaries, but this meal save path does not write individual meals to Firestore. RevenueCat identifies users with their Firebase UID in `context/AuthContext.tsx`.

Per the requested scope, keep cloud integration focused on numeric summaries; no cloud meal-image storage or sharing is implemented. The web app now reuses Firebase Authentication from the same project, while local guest and per-user browser data remain separate. RevenueCat and cloud totals are not connected by this change. The mobile project was not modified.

## Login and calorie setup

On first entry, choose sign-in, create account, or **Continue as guest**. Both signed-in and guest users can complete the profile questions: age, weight in kg, height in cm, gender used by the formula, and maintain/lose/gain goal. The web estimate supports adult profiles, validates inputs, and uses the mobile formulas: Mifflin-style BMR × 1.4; gain +250 kcal; lose −500 kcal; protein 2g/kg; carbs 50% of target calories; fat 30%. These independently assigned macros match the mobile app and do not necessarily sum to the calorie target. Users can skip setup and keep the current defaults, or revisit **Settings → Recalculate from my profile**. Completing setup updates targets without deleting meals.

For hosted or local Firebase login, ensure the app address is in Firebase Authentication → Settings → Authorized domains (including the chosen local host such as `127.0.0.1`). Email/password, Google, and Apple providers must be enabled/configured in that existing Firebase project. Apple web login needs its web provider configuration; native Apple login alone does not validate the web setup. Login failures display a useful message and retain guest access. See the official [password](https://firebase.google.com/docs/auth/web/password-auth), [Google](https://firebase.google.com/docs/auth/web/google-signin), and [Apple](https://firebase.google.com/docs/auth/web/apple) authentication guides.

Build/type checks and local data/calculation tests cover the implementation. Live sign-in, password reset delivery, and provider console settings require validation with an actual account; automated checks do not create users or send email.

## Text AI integration

`api/analyze.ts` adapts web requests to the same endpoint used in the mobile runtime configuration:

```text
https://macro-mate-backend-taupe.vercel.app/api/new_ui_copy
```

The mobile backend source at `/Users/amir/macro-mate-backend` was inspected read-only. Its default route already accepts `{ description, language }` and returns numeric macros plus an AI summary. No new model prompts or OpenAI keys are needed in this website. An optional **server-side** `FITMACRO_NUTRITION_ENDPOINT` environment variable can select another HTTPS endpoint; it is never read from the browser or supplied by an individual request.

The React form calls `/api/analyze`, shows loading/errors, then lets users review and correct the estimate before adding it to their log. Nothing is saved until they choose **Add Meal**. Requests send only the typed description and English language; images, Firebase user records, and profile details are not forwarded. Guest and signed-in users use the same analysis route. Changing the description after analysis requires a new estimate; manual meal edits remain available without an AI call.

The adapter rejects empty or oversized descriptions, validates returned numeric macros, uses a 55-second upstream timeout, avoids exposing backend error details, and applies best-effort per-instance burst protection (10 requests per minute per IP). This is not a durable, shared usage quota or a RevenueCat entitlement check. The inspected upstream endpoint has no authentication check; this adapter does not change the mobile backend’s public access policy.

`npm run dev:dashboard` now serves both the browser app and its local API adapter. **Restart any preview that was running before this change.** `FITMACRO_DEV_PORT=5174 npm run dev:dashboard` can use another local port. The website’s existing Vercel project discovers `api/analyze.ts`; the function has a 60-second configured duration. No backend or website deployment is performed by the build command.

## Mobile-style result screens

`MealResult.tsx` follows the mobile `app/meal-result.tsx` and `app/barcode-result.tsx` screens. Text analysis opens a distinct result view with a Text badge, short meal title/subtitle, colored macro snapshot, ingredient rows, and a sticky Log Meal action. Numeric fields and the date are behind **Edit nutrition & date**. Ingredient changes use the mobile endpoint’s `correctedIngredients` contract; Update nutrition recalculates the estimate before logging, while Discard changes restores the last analyzed ingredients. Returning to entry preserves the original typed description.

The component also implements the photo variant (image hero and overlaid summary) and barcode variant (product hero/fallback, brand/base-serving details, amount entry, Calculate, scaled macros, Log Meal, Scan again). All variants are connected to their capture controls. Photo JPEGs are compressed in the browser (1600 px maximum dimension), sent transiently through `/api/analyze` to the existing mobile `/api/nutrition` endpoint, and retained only in browser IndexedDB for local history. The selected mobile route forwards inline photos for analysis without image-storage operations or logging raw image data. No image is saved in Firebase Storage or server disk. AI-provider retention policies still apply. Barcode portion calculation is required before saving when a measurable base serving exists; changing the amount invalidates the previous calculation.

The web adapter preserves only validated title/subtitle/ingredient metadata along with numeric macros. Metadata is displayed during review; saved meal records retain their existing numeric/description format. Restart the local dev server after API changes so its bundled adapter picks up the metadata and ingredient-correction changes.

## Meal history

The history dialog follows mobile `app/(tabs)/history.tsx`, `components/MealCard.tsx`, and `components/FavoritesModal.tsx`, using the web dark theme. Daily history includes the selected date, a meal-count snapshot, protein/calorie totals, timestamped meal cards, edit/delete actions, and favorites. Editing or adding from history returns to the selected day afterward. Delete actions ask for confirmation.

Weekly history covers seven local calendar days ending on the selected date; monthly history covers its calendar month. Both summarize browser-local logs and show calorie trends. Clicking a trend day opens its daily history. These views do not fetch mobile cloud summaries or estimate body-weight changes.

Favorites are independent meal snapshots within the same guest/account-local data record. They survive deletion of the source log. Logging a favorite creates a fresh entry for today without calling AI. Existing data without the optional `favorites` array loads normally; favorite data is validated on restore and included in JSON exports.

## Public entry and shared subscriptions

`/free-ai-calorie-counter` serves the prerendered public React entry, with a meal-description form before any login or profile questions. It has a canonical URL, description/Open Graph metadata, a sitemap entry, and a link from the existing website. `/dashboard/` remains available. Profile setup is offered after the first saved meal, and users can skip it.

The Plans panel prepares RevenueCat hosted checkout under the existing Firebase UID and recognizes mobile Pro/Pro+ entitlements server-side. Web checkout stays disabled until configured; no live payments or RevenueCat products were created. Free analysis is now limited server-side to three per UTC day, with transactional production storage and a clearly labeled in-memory local preview.

Follow [BILLING-SETUP.md](./BILLING-SETUP.md) to configure credentials, attach web products to the mobile entitlements, and validate sandbox purchases across platforms. Restart `npm run dev:dashboard` after server or environment changes. Existing guest users may open the public entry in a private window to see the first-visit experience.


### Photo and barcode setup
No website OpenAI key is needed. Photo analysis defaults to the existing mobile `/api/nutrition` route, optionally overridden with server-only `FITMACRO_PHOTO_ENDPOINT`. Text keeps using `/api/new_ui_copy`. The mobile backend source remains unchanged. Barcode lookup uses Open Food Facts (ODbL), returns only product name, brand, and complete per-100g nutrition, and requires users to calculate a portion. Missing products/nutrition fall back to manual entry, with no AI guessing. Browser cameras require HTTPS or localhost and user permission; gallery and barcode-number entry remain available when camera access fails. Camera streams stop on close or mode change. Photos are stored in IndexedDB separate from numeric JSON exports and are not synced across devices. Clearing browser data removes them. Real-device camera/gallery and provider acceptance need manual testing after deployment.
