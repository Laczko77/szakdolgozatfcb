---
name: /jegyek availability gated by match_sectors (F27.4)
description: "Jegyvásárlás elérhető" pillula only renders when match has match_sectors rows; the listing page fetches the lookup itself
type: project
---

The `/jegyek` listing page (`src/app/jegyek/page.tsx`) issues a second Supabase query after `fetchMatches()`:

```ts
const { data: sectorRows } = await supabase
  .from("match_sectors")
  .select("match_id")
  .in("match_id", data.map((m) => m.id));
```

The resulting `Set<string>` (`matchesWithSectors`) is passed as a prop to both `<MatchesTable />` and `<MatchListMobile />`. Both components downgrade an `available` derived status to `soon` when the match.id is missing from that set.

**Why:** `deriveMatchStatus()` was originally date-only — any match within `availableWindowDays` shows the "Jegyvásárlás elérhető" pill, even if the admin has not configured sectors yet. Result: users clicked through to a detail page that immediately said "no sectors available". F27.4 closes that gap on the listing.

**How to apply:**
- Don't render purchase CTAs based purely on date — always check `matchesWithSectors`.
- The `/api/matches` endpoint still returns a flat `Match[]` (no sector aggregation). The frontend does the lookup itself; do NOT modify the API for this gate.
- Both `MatchesTable` and `MatchListMobile` accept `matchesWithSectors?: ReadonlySet<string>`. The prop is optional — if undefined, the component falls back to date-only behaviour, which keeps the components reusable elsewhere (e.g. dashboard widgets).
