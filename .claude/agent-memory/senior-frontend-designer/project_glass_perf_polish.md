---
name: Glass utility performance polish (F16)
description: globals.css adds @supports backdrop-filter fallback, mobile blur dial-down, and will-change to .glass-card
type: project
---

In F16 the liquid-glass utilities in `src/app/globals.css` got three production-grade tweaks:

1. **`will-change: transform` on `.glass-card`** — keeps each card on its own compositor layer so hover lift / Framer Motion reveals don't trigger paint on neighboring cards. Critical for the shop / news / players grids that can hold 12+ cards on desktop.
2. **`@supports not (backdrop-filter: …)` block** inside `@layer components` — falls back to `background: var(--bg-secondary)` for `.glass-card`, `.glass-card-strong`, `.glass-nav`, `.glass-button-primary`, `.glass-button-secondary` on browsers without backdrop-filter support.
3. **`@media (max-width: 640px)` dial-down** — drops `.glass-card` blur from 12px→6px (saturate 140%→120%) and `.glass-card-strong` from 50px→20px (saturate 160%→130%) on phones. The card still reads as glass thanks to border + inset highlight; GPU work is roughly a quarter.

**Why:** F16's mobile audit flagged that the shop/news/players grids could hold 6+ glass cards in a single mobile viewport, and the heavy blur radii were dominating paint timing.

**How to apply:** Future glass elements should reuse `.glass-card` / `.glass-card-strong` rather than reimplementing `backdrop-filter` inline — they automatically inherit the fallback, the mobile dial-down, and the compositor hint. If a one-off element really must use raw backdrop-filter, mirror the same `@supports` guard inline.
