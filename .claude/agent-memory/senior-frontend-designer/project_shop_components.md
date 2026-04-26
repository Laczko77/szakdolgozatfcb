---
name: Shop component primitives (F8)
description: Reusable storefront pieces under src/components/shop — RatingStars, WishlistHeart, VariantPicker, QuantityStepper, CartDrawer, ProductCard, ReviewList/Modal, OrderCancelButton, SuccessConfetti
type: project
---

The F8 iteration introduced a set of small, self-contained shop primitives. When future iterations need any of these mechanics, reach for the existing component instead of re-implementing.

- `RatingStars` — read-only OR interactive (1–5). Used by product cards, detail page, review list, review modal.
- `WishlistHeart` — animated CSS pop, reads/writes via `useCart()`. `framed` prop toggles glass-pill vs. bare icon.
- `VariantPicker` — two-axis size+colour picker with stock-aware disabling. Pure presentational.
- `QuantityStepper` — round +/- pill, sm and md sizes.
- `CartDrawer` — globally mounted in layout, opened via `useCart().openCart()`. Mobile fullscreen, desktop 420px.
- `ProductCard` / `ProductGrid` / `ProductCardSkeleton` — listing primitives with Framer stagger reveal.
- `CategoryFilter` — pill-tab filter with `layoutId` animated active background.
- `ReviewList` / `ReviewModal` — review display + create modal.
- `OrderCancelButton` — drop-in cancel button with confirmation modal; respects backend rule (no cancel after shipped/delivered).
- `SuccessConfetti` — pure-CSS deterministic confetti for the checkout success page (no canvas-confetti dep).

Shop API client is at `src/lib/shop-api.ts`; price/date formatters at `src/lib/format.ts`.

**Why:** The webshop is the largest UI surface; rebuilding these primitives in F13 (coupon checkout) or F15 (admin order detail) would invite drift. Small, well-named components are cheaper to compose than to recreate.

**How to apply:** When implementing F10 (profile orders tab), F13 (coupon-driven checkout), or F15 (admin order management), import the existing components and props rather than re-implementing review stars, cancel buttons, or product cards.
