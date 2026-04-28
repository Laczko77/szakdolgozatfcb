---
name: Tickets primitives (F9 / F20)
description: Component inventory and route layout for the ticket system, including the F20 fixed-sector redesign
type: project
---

F9 — Ticket system UI is shipped under `/jegyek`, `/jegyek/[id]` and `/jegyeim`.

**Why:** All four backend endpoints (GET /api/matches, GET /api/matches/[id], GET /api/tickets, POST /api/tickets/purchase) from Backend Iteration 6 are wrapped by `src/lib/tickets-api.ts`. The detail endpoint already returns sectors enriched with `available_seats` + `is_sold_out`, so the frontend never recomputes availability.

**How to apply:** Reuse these primitives in `src/components/tickets/`:
- `MatchStatusBadge` + `deriveMatchStatus(iso, now?, availableWindowDays=60)` — three-state pill (available / soon / past).
- `MatchesTable` (F20.1) — desktop sticky-header table for `/jegyek`; columns: Dátum, Hazai, vs., Vendég, Bajnokság, Státusz, Jegy. Accept `forcedStatus` prop to render the past-archive variant.
- `MatchListMobile` (F20.1) — mobile (<768px) compact strip-list mirror of the table.
- `MatchesTableSkeleton` (F20.1) — skeleton with both desktop table and mobile strip variants.
- `MatchCard` — old grid-card layout, NO LONGER USED on the listing page. Kept around in case future pages need a card-like surface.
- `MatchListEmptyState` — copy-driven empty state for both upcoming & past.
- `StadiumMap` (F20.2 fixed layout) — viewBox 800×500, four hard-coded `<rect>` slots: GOL NORD top, GOL SUD bottom, TRIBUNA left, LATERAL right, pitch in the middle. Sectors are matched by name from `FIXED_SECTORS`; missing sectors render as grey "Hamarosan". Tooltip is cursor-anchored (Framer Motion).
- `SectorListAlt` (F20.5) — always renders all four `FIXED_SECTORS` in canonical order with a capacity progress bar; missing/sold-out cards are non-interactive.
- `TicketSelectionPanel`, `PurchaseSuccess`, `MyTicketCard` — unchanged from F9.
- Sector domain: `import { FIXED_SECTORS, type SectorName } from '@/lib/constants/sectors'`. Names are immutable (DB CHECK constraint).

**Auth gate:** `/jegyek` and `/jegyek/[id]` are public; auth bounce happens at "Jegyvásárlás (demo)" click. Only `/jegyeim` is wrapped in `ProtectedRoute`.

**Admin (F20.6):** `src/app/admin/meccsek/page.tsx` no longer has an "Új szektor" form. The dialog only edits `total_seats` + `price`; `sector_name` is read-only text. A "Szektorok újragenerálása" button calls `POST /api/admin/matches/[id]/seed-sectors` (idempotent — preserves admin edits).
