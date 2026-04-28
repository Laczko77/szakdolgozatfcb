---
name: Backend-Frontend Dependency Map
description: Which frontend iterations depend on which backend iterations
type: project
---

Frontend → Backend dependency map:
- F1 → Backend 1 (project setup)
- F2 → Backend 2 (auth)
- F3 → none (static landing)
- F4 → Backend 2 (auth)
- F5 → Backend 3-7 (dashboard widgets aggregate)
- F6 → Backend 3 (CMS)
- F7 → Backend 4 (API-Football players)
- F8 → Backend 5 (Webshop)
- F9 → Backend 6 (Tickets)
- F10 → Backend 7 (Profile + Search)
- F11 → Backend 8 (Social feed)
- F12 → Backend 9 (Polls)
- F13 → Backend 10 (Point shop)
- F14 → Backend 11 (Cookie tracking)
- F15 → Backend 3-12 (Admin panel covers all)
- F16 → all (final polish)
- F17 → Backend 13 (football-data.org migration)
- F18 → Backend 14 (kritikus bug fixek)
- F19 → Backend 15 (standings & scorers API)
- F20 → Backend 16 (fix sector architecture)
- F21 → Backend 17 (poll "none" option)
- F22 → Backend 19 (dream team persistence)
- F23 → Backend 18 (DM & follow system)

**Why:** Parallel iteration selection requires checking the frontend iteration's backend dependency state.

**How to apply:** When selecting parallel iterations, verify the frontend candidate's backend dependency is DONE. If not, only the backend iteration runs that cycle. Special note: F22 depends on Backend 19 (the LAST new backend iteration), so frontend cannot run F22 until late in the cycle. F23 depends on Backend 18 (DM + follows). The natural parallel order is: Backend 14 + F18 (after B14 done), Backend 15 + F19 (after B15 done), Backend 16 + F20, Backend 17 + F21, Backend 18 + F23, Backend 19 + F22.
