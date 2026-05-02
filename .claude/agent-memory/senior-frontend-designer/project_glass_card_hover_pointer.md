---
name: glass-card-hover gated by pointer media query (F27.2)
description: `.glass-card-hover` is only active inside `@media (hover: hover)` to avoid sticky hover state on touch
type: project
---

`.glass-card-hover` (and the auto-applied `.glass-card.glass-card-hover` selector) lives inside an `@media (hover: hover)` block in `src/app/globals.css` since F27.2.

Dark-mode hover values (per project design spec):
- `background: rgba(255, 255, 255, 0.12)`
- `border-color: rgba(255, 255, 255, 0.25)`
- `transform: translateY(-2px) scale(1.01)`
- `transition: all 0.2s ease`

Light mode is overridden separately (`[data-theme="light"] .glass-card-hover:hover`) to use the existing `--glass-bg-hover` / `--glass-border-hover` tokens — the white-on-white rgba would wash out the cream background.

**Why:** Without the pointer guard, tapping a glass card on iOS/Android leaves the lifted/highlighted state visible until the next interaction — the user's finger triggers `:hover`, and mobile browsers don't clear the state on tap-and-release. F27.2 fixed this app-wide and aligned the hover language with `.player-card`, which already uses `@media (hover: hover) and (pointer: fine)`.

**How to apply:** Don't add `:hover` styles to interactive glass surfaces outside the existing `@media (hover: hover)` blocks. New hover effects on glass should reuse `.glass-card-hover` rather than re-defining the lift.
