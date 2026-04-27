---
name: Coupons component primitives (F13)
description: Iteration F13 point-shop + redeemed-coupon UI primitives — what exists under src/components/coupons and the supporting routes/api client
type: project
---

F13 (Pont-Áruház & Kuponrendszer UI) introduced these components and routes.

**`src/components/coupons/`**
- `CouponCard` + `CouponCardSkeleton` — ticket-style glass card with semicircle cut-outs and dashed perforation; tone is per `discount_type` (gold/red/blue). Disables CTA + shows hint when balance is insufficient or user is anonymous.
- `RedeemConfirmModal` — confirmation dialog before charging points. Shows post-spend balance preview. Backdrop + Escape close (unless submitting).
- `CouponCodeReveal` — celebratory dialog after redeem. Reuses the F8 `SuccessConfetti` (CSS only, deterministic). One-click clipboard copy with check-mark feedback.
- `RedeemedCouponCard` — profile-side variant. Used codes are dimmed + `grayscale` and carry a diagonal "Felhasználva" stripe. Active codes are loud and copyable.
- `CouponEmptyState` — shared "nothing here yet" panel for `/pont-aruhaz` and `/kuponjaim`, has `default` and `compact` variants.

**Routes**
- `/pont-aruhaz` — public, balance hero + 3-col coupon grid. NOT wrapped in ProtectedRoute (visitors can browse); only the redeem CTA is auth-gated.
- `/kuponjaim` — `ProtectedRoute`, two-section layout (Aktív kiemelve / Felhasznált halványítva), stats strip, standalone destination until F10's /profil shell ships (mirrors the /pontjaim pattern).

**API client**: `src/lib/coupons-api.ts`
- `fetchActiveCoupons(signal)` → public coupon list
- `redeemCoupon(couponId)` → POST /api/shop/coupons/[id]/redeem
- `fetchMyCoupons({ isUsed?, signal })` → caller's redeemed coupons (joined with `coupon` definition under `RedeemedCouponWithDef`)
- `formatDiscount(type, value)` → "−15%" / "−2 000 Ft" / "Ingyen szállítás"
- `previewDiscount(subtotal, type, value)` → **client-safe mirror** of the server-side `applyDiscount` in `lib/coupons.ts`. Duplicated rather than imported because the server module pulls in the service-role Supabase client. **If you change one, change both.**

**Checkout integration (F13.4)**
- `src/app/shop/checkout/page.tsx` now sends `coupon_code` to `/api/orders` (already accepted server-side).
- Live preview uses `previewDiscount` against the user's `fetchMyCoupons({ isUsed: false })` list — codes outside the user's vault show "Ismeretlen kuponkód" before submit. Final validation still happens server-side via `applyCouponToOrder`.
- A "Saját kuponjaid" picker chip-row offers up to 3 of the user's active codes for one-tap insertion.
- `shop-api.ts`: `CheckoutPayload` gained optional `coupon_code`; `createOrder` now returns `CreateOrderResponse` with the populated `coupon: { code, discount } | null` field.

**Why:** The point-shop is the only surface in the project that spends a real (in-app) currency the user has earned. The two-step "confirm → reveal" pattern keeps accidental spends rare and turns the redemption into a moment worth celebrating; the ticket-cut visual signature ties /pont-aruhaz and /kuponjaim into one system.

**How to apply:** When F9 (jegy checkout) lands, the same flow (`fetchMyCoupons` + `previewDiscount` + `consume_coupon` server side) applies. When F10 (/profil) lands, `/kuponjaim`'s structure is the canonical "Kuponjaim" tab content — embed it directly instead of re-implementing.
