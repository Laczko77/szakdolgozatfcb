---
name: La Liga stats widgets (F19)
description: F19 dashboard widgets and the football-data backend shape contract — esp. the missing scorer team.id
type: project
---

F19 La Liga widgets (`StandingsWidget`, `TopScorersWidget`) live in `src/components/dashboard/` and consume `/api/standings` + `/api/scorers`. Frontend client: `src/lib/football-stats-api.ts`.

**Why:** Both widgets self-fetch in their own `useEffect` and surface their own skeleton/error states, so the dashboard page does NOT track them in `DashboardData`. New widgets can follow the same self-contained pattern.

**How to apply:**
- Standings rows DO include `team.id` — use `FOOTBALL_DATA_BARCELONA_ID = 81` to highlight FCB.
- Scorers rows do NOT — `lib/football-data.ts#getTopScorers()` intentionally drops `team.id`. Match Barça scorers by name via `FOOTBALL_DATA_BARCELONA_NAME = "FC Barcelona"` (case-insensitive).
- Backend caches both responses for 1 hour in Supabase (`standings_cache`, `scorers_cache`). Frontend doesn't need to add its own polling.
- `cached_at` may be > 1h old when the upstream is rate-limited (`stale: true`). Both widgets render a quiet "Frissítve X órája" footer label in that case.
- Crest images: `crests.football-data.org` and `media.api-sports.io` are already whitelisted in `next.config.ts`. Use `<TeamCrest>` (size 20-24 for list rows).
- F19 widgets pin to `season=2025` (2025/26 La Liga season) so they don't drift when the year flips.
