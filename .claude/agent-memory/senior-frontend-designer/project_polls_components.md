---
name: Polls/Points component primitives (F12)
description: Iteration F12 polls + points UI primitives — what exists under src/components/polls and src/components/dashboard/ActivePollWidget
type: project
---

F12 (Szavazórendszer & Pontrendszer UI) introduced these components and routes:

**`src/components/polls/`**
- `PollStatusBadge` — Aktív (emerald, ping dot) / Lezárva (neutral) pill
- `PollMatchBadge` — lazy-fetches /api/matches/[id] to surface "FCB vs. X"
- `PollResultBar` — animated horizontal bar; isUserVote (gold star), isCorrect (emerald crown), both (check chip)
- `PointsEarnedBadge` — "+50 pont" celebratory chip with spring scale
- `PollCard` — full card with three states: vote-form / voted-active / resolved (uses AnimatePresence mode="wait")
- `PointsTransactionList` — vertical list with reason-sniffing icon resolver (Vote / Gift / Sparkles / arrows)
- `PollsEmptyState` + `PollCardSkeleton`

**`src/components/dashboard/ActivePollWidget.tsx`** — uses `WidgetShell`; collapses to "Leadva" tile after vote with link to /szavazasok.

**Routes**
- `/szavazasok` — public, two stacked sections (active + resolved)
- `/pontjaim` — ProtectedRoute, balance hero + stats strip + transaction history (placeholder for F10's profil tab)

**API client**: `src/lib/polls-api.ts` — `fetchPolls({status, matchId})`, `castVote(pollId, selectedOption)`. The `EnrichedPoll` type adds `results`, `total_votes`, `user_vote` to `Poll`.

**Why:** F10 (profile page) hadn't shipped yet, so /pontjaim is a standalone destination that F10 can later embed as a tab.

**How to apply:** When iterating on polls/points UI, reuse PollCard rather than building inline vote forms — its three-state machine handles the full lifecycle. Use PointsTransactionList for any transaction-history surface.
