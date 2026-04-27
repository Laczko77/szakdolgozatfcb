---
name: F14 cookie consent + tracking primitives
description: ConsentProvider + CookieBanner + usePageTracking + PopularProducts/RecommendedProductsWidget — the F14 frontend stack
type: project
---

F14 introduces a localStorage-backed consent layer plus page-view tracking and recommendation rails.

**Why:** GDPR requires an explicit decision before any tracking; once accepted the same `cookie_id` UUID is replayed on every `/api/tracking/pageview` request. Recommendation rails consume the public `/api/products/recommended` endpoint backed by the `recommended_products` SQL view (view_count + avg_rating blend).

**How to apply:**
- Read consent state via `useConsent()` from `src/providers/ConsentProvider.tsx` — never hit localStorage directly. The provider broadcasts a `fcb-consent-changed` CustomEvent so the same-tab UI updates immediately.
- The provider is mounted globally inside `CartProvider` in `src/app/layout.tsx`. `<CookieBanner />` and `<PageTrackingMount />` (hook-only client component wrapping `usePageTracking`) sit alongside `<CartDrawer />`.
- Storage helpers (`getStoredConsent` / `setStoredConsent` / `CONSENT_*` keys) live in `src/lib/consent.ts`.
- API client (`postConsent`, `postPageView`, `fetchRecommendedProducts` + `RecommendedProduct` type) lives in `src/lib/analytics-api.ts`. Pageview pings use `keepalive: true` and swallow errors.
- `usePageTracking` (`src/hooks/usePageTracking.ts`) extracts the product UUID from `/shop/<uuid>` paths via a regex and deduplicates per pathname through a ref.
- Recommendation rails self-hide when fewer than 3 ranked products are returned: `PopularProducts` (`src/components/shop/PopularProducts.tsx`) on the storefront, `RecommendedProductsWidget` (`src/components/dashboard/RecommendedProductsWidget.tsx`) paired with QuickLinks (8/4 split) on the dashboard.
