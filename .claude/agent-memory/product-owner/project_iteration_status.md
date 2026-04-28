---
name: Iteration Status Snapshot
description: Backend and frontend iteration completion status as of 2026-04-28 — Backend 15 DONE, F18 DONE; F19 dependency unblocked
type: project
---

Backend completed iterations: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 — DONE (70/92 tasks, 76%)
Backend pending iterations: 16 (fix sectors), 17 (poll "none" option), 18 (DM + follows), 19 (dream team persistence) — 22 tasks remaining

Frontend completed iterations: F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F16, F17, F18 — DONE (113/149 tasks, 76%)
Frontend pending iterations: F19 (dashboard standings/scorers — UNBLOCKED, Backend 15 DONE), F20 (jegyek táblázat + fix sector SVG), F21 (poll none UI), F22 (dream team drag-and-drop), F23 (3 oszlopos közösség + DM) — 36 tasks remaining

**Combined totals:** 183/241 tasks, ~76%.

**Why:** Track which iterations are done so future iteration selection picks the right next one and doesn't reopen completed work.

**How to apply:**
- Next backend candidate: Iteration 16 (fix sector architecture — depends on Iteration 1 + 6, both DONE)
- Next frontend candidate: F19 (dashboard standings & scorers widget) — Backend 15 dependency now satisfied
- Backend 16 + F19 can run in parallel (no shared scope; F19 consumes already-shipped Backend 15 endpoints)
- F20 → Backend 16, F21 → Backend 17, F22 → Backend 19, F23 → Backend 18

Wishlist verification (2026-04-28): `src/app/wishlist/page.tsx` exists and is 194 lines (functional). F18.3 navigation task completed.
