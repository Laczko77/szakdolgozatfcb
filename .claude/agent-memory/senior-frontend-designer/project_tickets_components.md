---
name: Tickets primitives (F9)
description: Component inventory and route layout for the F9 ticket system implementation
type: project
---

F9 — Ticket system UI is shipped under `/jegyek`, `/jegyek/[id]` and `/jegyeim`.

**Why:** All four backend endpoints (GET /api/matches, GET /api/matches/[id], GET /api/tickets, POST /api/tickets/purchase) from Backend Iteration 6 are wrapped by `src/lib/tickets-api.ts`. The detail endpoint already returns sectors enriched with `available_seats` + `is_sold_out`, so the frontend never recomputes availability.

**How to apply:** Reuse these primitives in `src/components/tickets/` for any future ticket-related UI:
- `MatchStatusBadge` + `deriveMatchStatus(iso, now?, availableWindowDays=60)` — three-state pill (available / soon / past). The window default is 60 days, override if the season scheduling changes.
- `MatchCard` — list-grid card with poster-style stacked team names, status pill, gradient stripe. Pass `status="past"` to force the muted variant.
- `MatchListSkeleton` / `MatchListEmptyState` — loading + empty fallbacks for the match grid.
- `StadiumMap` — SVG bowl with 8-slot (or 6-slot fallback) sector layout. The slot positions are tuned for a 600×420 viewBox; sector count > 8 is silently truncated. Tooltip is glass card top-right.
- `SectorListAlt` — touch-friendly grid mirror of the SVG, used below it on mobile (`lg:hidden`).
- `TicketSelectionPanel` — selection rail. Quantity is clamped on render (no setState-in-effect); the inner state can drift above maxQty between sector switches but the displayed/submitted value is always clamped.
- `PurchaseSuccess` — success state with stacked "DigitalTicketCard" components. Uses CSS `cta-pulse` keyframe for the success icon glow, plus a deterministic barcode from the ticket id.
- `MyTicketCard` — wallet-style row for `/jegyeim`; `variant="past"` for the muted look.

**Auth gate:** `/jegyek` and `/jegyek/[id]` are public; the auth bounce happens at the moment the user clicks "Jegyvásárlás (demo)" in `TicketSelectionPanel` (the detail page redirects to `/login?returnUrl=/jegyek/<id>`). Only `/jegyeim` is wrapped in `ProtectedRoute`.
