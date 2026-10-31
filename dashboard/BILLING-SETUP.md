# Activate FitMacro web subscriptions

The integration is prepared locally. No web products, payment accounts, live purchases, Firebase rules, or deployments were created. Existing iOS/Android source was read but not modified.

## RevenueCat

Use the **same RevenueCat project** as the mobile apps. Mobile identity already calls `Purchases.logIn(firebaseUser.uid)`.

1. Add a Web Billing configuration and connect the payment provider in RevenueCat. Create web subscription products and an offering with their real prices and renewal periods.
2. Attach web products to the existing mobile entitlements: `premium` for Pro and `fitmacro.pro_plus.monthly` for Pro+. The latter is the exact entitlement string checked by this mobile backup, despite its product-like name. Verify those identifiers in your live mobile releases before enabling checkout.
3. Create a Web Purchase Link for the web offering. Configure returning subscribers to skip another purchase, and set the post-purchase redirect to `https://www.fitmacro.ca/free-ai-calorie-counter`.
4. Set the **base production link**, such as `https://pay.rev.cat/<token>`, in `REVENUECAT_PURCHASE_LINK`. The server appends the verified Firebase UID as the URL-encoded path segment. Do not insert a customer ID yourself.
5. Set a RevenueCat **API v1-compatible server key** for that same project in `REVENUECAT_API_KEY`. It is used only on the server to retrieve subscriber entitlements. Never put it into React or public assets.

Signed-in users are required for checkout. A guest cannot buy under an anonymous or browser-supplied account ID. Returning from checkout does not grant access: `/api/subscription` checks RevenueCat, and `/api/analyze` checks again before each analysis. Existing paid mobile users are recognized through the same Firebase UID. Expiration, grace periods, and sandbox status are checked. Refresh purchase status is available in the Plans panel; active subscriptions expose RevenueCat’s management URL when provided.

No prices are invented in the web UI. The hosted checkout displays the configured products, currencies, renewal terms, and cancellation information before the user pays.

Official setup: [Web Purchase Links](https://www.revenuecat.com/docs/web/web-billing/web-purchase-links), [Customer lookup](https://www.revenuecat.com/docs/api-v1/customers).

## Firebase and daily allowances

Copy `.env.example` to an ignored `.env.local` for local configuration, or set its variables in Vercel for production. Never share service-account private keys or RevenueCat secret keys in chat.

- `FIREBASE_SERVICE_ACCOUNT_JSON`: server-side service-account JSON for `fitmacro-e0d48`, with permission for the Firestore usage collection. It is not the public Firebase web configuration.
- `FITMACRO_USAGE_SALT`: a random, stable server secret used to hash identity keys. Rotating it resets allowance identities for that day.
- `REVENUECAT_API_KEY` and `REVENUECAT_PURCHASE_LINK`: as above.

Production quotas use Firestore transactions under `fitmacroWebUsage/{hashedIdentity}_{UTC-date}`. Guests share a network allowance based on Vercel’s supplied client address; signed-in users use the verified Firebase UID. Raw IP addresses, descriptions, and meal images are not stored in these usage records. Counts expire logically at midnight UTC. The optional `expiresAt` field can be configured as a Firestore TTL policy for cleanup.

The free web allowance is **three successful AI analyses daily**. Each ingredient recalculation is another analysis. A slot is reserved before contacting AI and refunded on failure. Reservations are transactional, preventing concurrent requests from overspending the allowance. Paid accounts bypass this daily allowance but retain technical burst limits. Manual entry, favorites, and history do not call AI and do not consume allowance.

Ensure client Firestore rules do **not** allow clients to write or read `fitmacroWebUsage`. Admin access bypasses client rules. An explicit deny does not override another broad allow rule, so review existing recursive rules before going live. The integration does not change existing mobile rules.

Without service-account configuration, the local preview uses a shared in-memory allowance and labels it as a preview. Restarting the local server resets it. Production fails closed for AI requests if durable quota configuration is missing; it never silently grants unlimited guest access. Basic login and manual tracking remain available.

Firebase references: [Verify ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).

## Verify before enabling payments

To test on your existing domain, set `REVENUECAT_PURCHASE_LINK` to the sandbox base link and `REVENUECAT_ALLOW_SANDBOX=true`, then redeploy. No separate Vercel Preview is required. To launch live billing, replace the link with the production base link, set `REVENUECAT_ALLOW_SANDBOX=false`, and redeploy. The server secret API key stays the same; this hosted checkout integration does not use a public Web SDK key.

Test a free account, a paid iOS account, a paid Android account, and a web purchase under the same Firebase UID. Confirm the web purchase unlocks the expected entitlement after signing into each mobile app. Check expiry/cancellation, billing grace, checkout cancellation, refund state, and subscription management in the provider sandbox. No test here creates a charge or proves live payment-provider setup.

The inspected legacy mobile AI endpoint remains publicly callable and has no server entitlement check. Web allowance enforcement protects the new web adapter, not that existing endpoint. Full production abuse protection requires hardening the shared mobile backend and updating mobile clients to send verified Firebase tokens; that was not performed in this repository-only integration.

Dependency audit currently reports unresolved advisories in the Firebase/Google/Vercel dependency trees after compatible updates. Review and resolve these with supported dependency/runtime upgrades before production payment activation; no forced major-version changes were applied.
