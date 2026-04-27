---
name: Iter13 — football-data.org API migration
description: Why the project migrated off api-sports.io and what stat fields became unavailable
type: project
---

Iter13 (2026-04-27) replaced the api-sports.io ("API-Football") integration with football-data.org v4.

**Why:** The free api-sports.io tier has a hard 100 requests/day cap and only exposes seasons 2022–2024 — neither the 2025/26 season nor the production sync cadence fit. football-data.org's free tier is rate-limit-bound (10/min) but unrestricted on seasons.

**How to apply:**
- The `players` table's `stats` JSON keeps `games_started`, `minutes`, `yellow_cards`, `red_cards` fields, but they will always be 0 — football-data.org's `/competitions/{id}/scorers` endpoint does not expose them. Frontend should not surface these as primary metrics.
- FCB team id changed: api-sports used 529, football-data.org uses 81. Anything new wiring into the football API must use 81 (see `FCB_TEAM_ID` in `src/lib/football-data.ts`).
- Players sync aggregates La Liga (comp 2014) + Champions League (comp 2001) scorer rows; players who have not appeared in either competition this season legitimately end up with all-zero stats — that is success, not error.
- Matches sync writes `venue: null` always — `/teams/{id}/matches` does not include venue. If we ever need it, the per-match `/matches/{id}` endpoint has it but costs an extra call per match.
