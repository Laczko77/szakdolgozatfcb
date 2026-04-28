---
name: Iteration Status Snapshot
description: Backend and frontend iteration completion status as of 2026-04-28 — Backend 17 DONE, F20 DONE; F21 dependency unblocked
type: project
---

Backend completed iterations: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 — DONE (80/92 tasks, 87%)
Backend pending iterations: 18 (DM + follows), 19 (dream team persistence) — 12 tasks remaining

Frontend completed iterations: F1–F20 — DONE (125/149 tasks, 84%)
Frontend pending iterations: F21 (poll none UI — UNBLOCKED, Backend 17 DONE), F22 (dream team drag-and-drop — depends on Backend 19), F23 (3 oszlopos közösség + DM — depends on Backend 18) — 24 tasks remaining

**Combined totals:** 205/241 tasks, ~85%.

**Why:** Track which iterations are done so future iteration selection picks the right next one and doesn't reopen completed work.

**How to apply:**
- Next backend candidate: Iteration 18 (DM + follows — depends on Iteration 2, 8, both DONE)
- Next frontend candidate: F21 (poll "none" UI) — Backend 17 dependency now satisfied
- Backend 18 + F21 can run in parallel (no shared scope; F21 consumes already-shipped Backend 17 endpoints)
- F22 → Backend 19, F23 → Backend 18
