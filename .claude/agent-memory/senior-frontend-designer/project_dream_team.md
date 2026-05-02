---
name: Dream team primitives (F22)
description: Drag-and-drop álomcsapat builder — @dnd-kit/core based, 4 formations, mobile tap-to-select fallback
type: project
---

F22 Dream Team feature components live under src/components/dream-team/:
PitchSVG (SVG pitch + droppable slot overlay with Framer Motion `layout`
transitions on formation change), PlayerSlot (single droppable cell;
glows green for compatible, red for incompatible during drag),
DraggablePlayerCard (pool card; useDraggable on desktop, tap on mobile),
PlayerPool (left column with position filter pills),
FormationSelector (4 formation pills with active gold pill),
DreamTeamToolbar (name input + Save/New/Delete buttons),
DeleteConfirmModal (custom glass modal — not Radix Dialog).

Route: /jatekosok/almomcsapat (ProtectedRoute-wrapped).

Library boundaries:
- `@dnd-kit/core` is the canonical DnD lib (added in F22). `@dnd-kit/utilities` and `@dnd-kit/sortable` come along — sortable is unused here but installed for future iterations.
- Mobile detection via `src/hooks/useMediaQuery.ts` (queueMicrotask-wrapped initial setState — same convention as the rest of the codebase).
- DragOverlay used for the cursor ghost (rotated -2deg, see page.tsx).

Formation slot config: `src/lib/dream-team-formations.ts` — exact slot
coordinates (x%, y% on an 800×1100 SVG viewBox) and `accepts: PlayerPosition[]`
for each of 11 slots × 4 formations. Slot indices are persisted to the DB
— never renumber existing slot indexes when editing this file.

API client: `src/lib/dream-team-api.ts` — wraps the mixed envelope split
in the existing routes (POST/PUT return `{data}`, GET-list returns
`{items}`, GET-single returns raw object, DELETE returns `{success}`).

Why: Backend Iteration 19 already shipped the API; F22 is purely the
frontend builder.

How to apply: When adding new formations, edit FORMATIONS map; when changing
slot validation logic, prefer `slotAcceptsPosition()` over inline checks.
The `position` field persisted to the DB is the slot's role label
("GK"/"DEF"/"MID"/"ATT"/"ST"), not the player's football-data position
string — keep this in mind when reading saved teams.

F27.6 update: `slotAcceptsPosition()` now returns true for any non-null
position. The `slot.accepts` arrays still drive the role *label* on the
pitch but no longer reject drops — any player can be placed on any slot
(supports inverted full-back / false-9 line-ups). The error toast in
`placePlayerOnSlot` is dormant in practice; PitchSVG drag-highlight now
glows on every slot during a drag.
