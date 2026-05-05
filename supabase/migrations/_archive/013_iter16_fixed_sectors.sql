-- ============================================================================
-- Iteration 16 — Fixed Sector Architecture
-- ============================================================================
-- Replaces the dynamic sector model (admin can create arbitrary sectors per
-- match) with a fixed domain of 4 sectors that is always seeded for every
-- match: TRIBUNA, LATERAL, GOL NORD, GOL SUD. This guarantees the SVG stadium
-- map on the frontend can render a consistent layout for every fixture.
--
-- User decision: we are still in the test phase, so all existing sectors and
-- tickets are wiped. The CHECK constraint only applies to new rows, so the
-- DELETE is required (otherwise the ALTER would still succeed but a stray
-- row could remain that the constraint never sees on later updates).
-- ============================================================================

-- ---- 1. Wipe legacy data ---------------------------------------------------
-- Tickets first (FK -> match_sectors with ON DELETE RESTRICT).
DELETE FROM public.tickets;
DELETE FROM public.match_sectors;

-- ---- 2. Constrain sector_name to the fixed domain --------------------------
ALTER TABLE public.match_sectors
  DROP CONSTRAINT IF EXISTS match_sectors_sector_name_check;

ALTER TABLE public.match_sectors
  ADD CONSTRAINT match_sectors_sector_name_check
  CHECK (sector_name IN ('TRIBUNA', 'LATERAL', 'GOL NORD', 'GOL SUD'));

-- ---- 3. UNIQUE (match_id, sector_name) -------------------------------------
-- Required so the auto-seed in /api/admin/matches/sync can use
-- INSERT ... ON CONFLICT DO NOTHING (idempotent re-runs do NOT overwrite
-- admin-edited price / total_seats values).
ALTER TABLE public.match_sectors
  DROP CONSTRAINT IF EXISTS match_sectors_match_sector_uniq;

ALTER TABLE public.match_sectors
  ADD CONSTRAINT match_sectors_match_sector_uniq
  UNIQUE (match_id, sector_name);
