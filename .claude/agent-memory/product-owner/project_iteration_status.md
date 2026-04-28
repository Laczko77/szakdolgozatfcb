---
name: Iteration Status Snapshot
description: Backend and frontend iteration completion status as of 2026-04-28 — Backend 16 DONE, F19 DONE; F20 dependency unblocked
type: project
---

Backend completed iterations: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 — DONE (75/92 tasks, 82%)
Backend pending iterations: 17 (poll "none" option), 18 (DM + follows), 19 (dream team persistence) — 17 tasks remaining

Frontend completed iterations: F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19 — DONE (118/149 tasks, 79%)
Frontend pending iterations: F20 (jegyek táblázat + fix sector SVG — UNBLOCKED, Backend 16 DONE), F21 (poll none UI), F22 (dream team drag-and-drop), F23 (3 oszlopos közösség + DM) — 31 tasks remaining

**Combined totals:** 193/241 tasks, ~80%.

**Why:** Track which iterations are done so future iteration selection picks the right next one and doesn't reopen completed work.

**How to apply:**
- Next backend candidate: Iteration 17 (poll "none" option — depends on Iteration 9, DONE)
- Next frontend candidate: F20 (jegyek táblázat + fix sector SVG) — Backend 16 dependency now satisfied
- Backend 17 + F20 can run in parallel (no shared scope; F20 consumes already-shipped Backend 16 endpoints/constants)
- F21 → Backend 17, F22 → Backend 19, F23 → Backend 18
