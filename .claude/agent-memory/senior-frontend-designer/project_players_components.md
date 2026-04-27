---
name: Players component primitives (F7)
description: F7 player UI primitives — flip card, position pills, sections, radar/stat-grid; players-api.ts mirrors articles-api shape
type: project
---

F7 introduced the player browser UI under `src/components/players/`:
PositionPills, PlayerCard (CSS-only flip via globals.css `.player-card-*`
classes, gated behind `(hover: hover) and (pointer: fine)`),
PlayerCardSkeleton/PlayerGridSkeleton, PositionSection, PlayerStatRadar
(Recharts), PlayerStatGrid (Framer-animated progress bars).

Routes: `/jatekosok` (client, full squad fetched once + client-side
position filter mirrored to `?position=`) and `/jatekosok/[id]`
(server-rendered profile with hero / bio / radar / stat grid).

`src/lib/players-api.ts` mirrors `articles-api.ts` shape: `fetchPlayers`,
`fetchPlayer`, `readPlayerStats`. The canonical stats JSONB shape
(`goals, assists, appearances, minutes, yellow_cards, red_cards`) is
written by `src/app/api/admin/players/sync/route.ts` and parsed
defensively by `readPlayerStats`.

`src/lib/player-positions.ts` holds Hungarian labels:
`PLAYER_POSITION_LABELS` (singular), `PLAYER_POSITION_LABELS_PLURAL`
(section headers), `PLAYER_POSITION_SHORT` (2-letter badges).

**Why:** F7 added the first scroll-to-back flip card pattern in the
codebase; future iterations may reuse the `(hover: hover)` flip CSS.

**How to apply:** When adding more flip cards, reuse the
`.player-card-perspective / -inner / -face` utility classes in
globals.css rather than re-implementing the touch-safety gating. When a
new domain needs a "client-side filter mirrored to URL" pattern, the
`/jatekosok` page is the cleanest reference (single fetch, useMemo
buckets, replace history not push).
