---
name: Iteration Status Snapshot
description: Backend and frontend iteration completion status as of 2026-04-27
type: project
---

Backend completed iterations: 1, 2, 3, 4, 5, 6, 7, 8, 9 (46/68 tasks, 68%)
Frontend completed iterations: F1, F2, F3, F4, F5, F6, F8, F11 (53/86 tasks, 62%)

**Why:** Track which iterations are done so next-iteration selection is accurate.

**How to apply:** Backend Iteration 9 (Polls) just completed — newly unblocks Frontend F12 (Polls UI). Next backend candidate: Iteration 10 (Point shop, depends on Iterations 5, 6, 9 — all DONE). Next frontend candidates with backend ready: F7 (Players UI, Backend 4 DONE), F9 (Tickets UI, Backend 6 DONE), F10 (Profile + Search UI, Backend 7 DONE), F12 (Polls UI, Backend 9 DONE — newly unblocked). F13 still waits on Backend 10, F14 waits on Backend 11, F15 waits on Backend 3-12.
