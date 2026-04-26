---
name: Dashboard component primitives (F5)
description: Widget primitives and dashboard layout shipped in iteration F5
type: project
---

F5 dashboard at `src/app/dashboard/page.tsx` is wrapped with `<ProtectedRoute>` and composes widgets in a 12-col CSS grid. Component primitives under `src/components/dashboard/`:

- `WidgetShell` — shared eyebrow + title + meta + optional CTA chrome around children, runs the staggered Framer reveal via the `index` prop. Uses `glass-card` + `glass-card-hover`.
- `WidgetSkeleton` / `DashboardHeroSkeleton` — animate-pulse skeletons matched to the real card sizes.
- `DashboardHero` — greeting card with avatar (gold conic ring), time-aware "Jó reggelt/Szia/Jó estét" verb, today's Hungarian date.
- `NextMatchWidget` — span-8, four-cell countdown grid powered by `useCountdown(targetIso)`. Empty state when no upcoming match.
- `LatestNewsWidget` — span-8, three horizontal article rows (16:10 thumb on the left).
- `PointsWidget` — span-4, big Bebas Neue balance number + last transaction strip.
- `OrdersWidget` — span-4, latest order summary + StatusBadge (processing/shipped/delivered/cancelled colours match enum in types/database.ts).
- `QuickLinks` — 4-tile grid (Hírek/Shop/Jegyek/Közösség) with accent-colored icon discs (gold/red/blue/neutral).

Data layer at `src/lib/dashboard-api.ts` — `fetchNextMatch`, `fetchLatestArticles`, `fetchPoints`. Orders use the existing `fetchOrders()` from `lib/shop-api.ts`. The page fires all four in parallel with independent error handling so one slow endpoint can't block the rest.

`src/hooks/useCountdown.ts` — second-resolution countdown with `queueMicrotask` re-seed (sync setState in effects is blocked by lint).

Why: F5 backlog requires widget-based daily-hub UI for authenticated users; widgets must reuse design system primitives and call existing backend endpoints (matches/articles/orders/profile-points), not introduce a new aggregate /api/dashboard route.

How to apply: Reuse `WidgetShell` for any future dashboard widget rather than rebuilding the eyebrow/title chrome. New status badges should follow the StatusBadge config pattern in `OrdersWidget.tsx`.
