---
name: glass-modal utility (F27.3)
description: Canonical Tailwind utility classes `.glass-modal` and `.glass-modal-backdrop` in globals.css; use for every PUBLIC modal/dialog/popover panel
type: project
---

`.glass-modal` and `.glass-modal-backdrop` are the canonical surface tokens for public-facing modal/dialog/popover panels (introduced in Frontend Iteration F27.3, defined in `src/app/globals.css`).

`.glass-modal` resolves to: `rgba(10,12,24,0.92)` bg + `blur(24px) saturate(160%)` backdrop-filter + `1px solid rgba(255,255,255,0.10)` border + `rounded-[16px]` + `0 8px 32px rgba(0,0,0,0.6)` drop shadow. The `[data-theme="light"]` variant flips to `rgba(248,246,240,0.95)` with a black-tinted border and `0 8px 32px rgba(0,0,0,0.15)` shadow. `.glass-modal-backdrop` is the matching veil (`rgba(0,0,0,0.55)` + `blur(8px)`).

**Why:** Before F27 each public modal hand-rolled its own background/blur cocktail (`bg-[var(--bg-secondary)]/95 backdrop-blur-xl`, `glass-card-strong`, raw `bg-black/70` overlays, etc.). The look drifted between modals and dark/light themes. Centralising the surface keeps every modal's frosted-glass feel consistent. F28 raised the opacity (0.85→0.92 dark, 0.78→0.95 light) because the original mix was too transparent — page content bled through and collided with modal text.

**How to apply:**
- Public modals: replace bespoke panel classes (`bg-[var(--bg-secondary)]/95 backdrop-blur-xl`, `glass-card-strong`) with `glass-modal`. Replace bespoke backdrops (`bg-black/55 backdrop-blur-sm`, `bg-black/70 backdrop-blur-md`) with `glass-modal-backdrop`.
- Components already migrated: `dream-team/DeleteConfirmModal`, `coupons/RedeemConfirmModal`, `coupons/CouponCodeReveal`, `social/NewConversationModal`, `shop/ReviewModal`, `shop/OrderCancelButton`, `shop/CartDrawer` (backdrop only), `search/CommandPalette`, `auth/UserMenu` dropdown (F28), `common/CookieBanner` (F28).
- **Admin dialogs are intentionally NOT switched** — `AdminDialog` keeps its solid `bg-[var(--bg-secondary)]` per the existing admin-design memory. Glass is for the public chrome only.
- New modals: start from `glass-modal` rather than rolling your own surface.
