---
name: TeamCrest primitive (F17)
description: Reusable square crest component used wherever home_team / away_team pairs are rendered; handles fallback initials and Next/Image config for football-data.org
type: project
---

`src/components/tickets/TeamCrest.tsx` is the single primitive for rendering team crests across the app. Use it in any UI that shows a `Match` row.

**Why:** F17 added `home_team_crest` and `away_team_crest` to the `Match` type (football-data.org URLs). Without a shared primitive each surface ended up reimplementing the rounded-glass-plate + initials fallback differently.

**How to apply:**
- Always pass `url={match.home_team_crest}` (or away) and `teamName={match.home_team}` — the component computes initials internally for the null-URL case.
- `size` prop drives both pixel dimension and rendered size. Conventions in this codebase:
  - 28-32px → MyTicketCard, NextMatchWidget (compact rows)
  - 36-40px → MatchCard, PurchaseSuccess (list cards)
  - 48-72px → /jegyek/[id] hero (responsive: 48 on mobile, 64-72 on sm+)
- Uses `unoptimized` on `next/image` because crests are sub-100px and football-data.org returns a heterogeneous SVG/PNG mix that the Next image optimizer chokes on.
- `next.config.ts` has `crests.football-data.org` and `media.api-sports.io` in `images.remotePatterns` — adding new crest CDNs requires updating that file.
- The fallback uses gold (`var(--accent-gold)`) Bebas Neue initials on a glass plate, NOT a generic Lucide icon — keeps the design system coherent when crests are missing.

The admin pages (`/admin/jatekosok`, `/admin/meccsek`) do NOT use TeamCrest — they intentionally stay clean/functional and just show the team name strings.
