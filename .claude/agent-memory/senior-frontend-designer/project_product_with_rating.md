---
name: ProductWithRating shape on /api/products
description: Listing endpoint returns products with average_rating + review_count joined; ProductGrid reads them directly
type: project
---

The `/api/products` listing route returns each row enriched with `average_rating: number | null` and `review_count: number` (joined from visible reviews). The frontend type is `ProductWithRating` exported from `src/lib/shop-api.ts`.

**Why:** F24.1 fix — the previous typing dropped these fields, so `ProductGrid` always rendered 0 stars. The new shape is the canonical input for the grid; an optional `ratings?` map prop still exists as an override for sub-listings that pre-aggregated elsewhere.

**How to apply:** Anywhere a recommendation/related-products feed is built that flows into `<ProductGrid>`, project the source rows into `ProductWithRating` (set `average_rating` + `review_count` explicitly) — don't rely on the `ratings?` map for primary data. `PopularProducts.toProduct()` is the reference pattern.
