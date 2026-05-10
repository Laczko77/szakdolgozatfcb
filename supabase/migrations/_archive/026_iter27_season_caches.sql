-- ============================================================================
-- Iteration 27 — /season page backend caches.
-- ============================================================================
--
-- Goal: support the /season visualisation pages with three Supabase-backed
-- caches that mirror the (Iter15) standings_cache / scorers_cache pattern.
--
-- Tables
-- ------
--   1. season_evolution_cache  — `getCompetitionMatches()` aggregated into
--      round-by-round cumulative points / goal-difference / position per
--      team. TTL 12h.
--
--   2. season_form_cache       — last 10 finished matches of a given team in
--      a given competition+season, each tagged W/D/L. TTL 1h.
--
--   3. match_details_cache     — `getMatchDetails()` payload (goals,
--      bookings, substitutions). TTL 24h for finished matches, 5 min for
--      live ones — enforced by the API route, the table only stores the
--      `cached_at` timestamp.
--
-- Design notes
-- ------------
-- * Each table uses a TEXT `cache_key` as its UNIQUE index, mirroring the
--   composite-key shape used elsewhere but in a single string column. This
--   keeps the API code uniform across the three caches without introducing
--   a different (competition_id, season, team_id) tuple for each one.
--
-- * RLS: SELECT is public (so anon callers can read cached payloads); INSERT
--   / UPDATE / DELETE is restricted to the service-role key. The route
--   handlers use `createServiceRoleClient()` to write, identical to the
--   existing standings_cache / scorers_cache flow.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. season_evolution_cache
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_evolution_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  TEXT NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. season_form_cache
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_form_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  TEXT NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. match_details_cache
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_details_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  TEXT NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Enable RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.season_evolution_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_form_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_details_cache    ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. RLS policies — public SELECT, writes only via service-role.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "season_evolution_cache_select_public"
  ON public.season_evolution_cache;
CREATE POLICY "season_evolution_cache_select_public"
  ON public.season_evolution_cache FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "season_form_cache_select_public"
  ON public.season_form_cache;
CREATE POLICY "season_form_cache_select_public"
  ON public.season_form_cache FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "match_details_cache_select_public"
  ON public.match_details_cache;
CREATE POLICY "match_details_cache_select_public"
  ON public.match_details_cache FOR SELECT TO anon, authenticated USING (TRUE);

-- No INSERT / UPDATE / DELETE policies for any role: writes happen
-- exclusively via the service-role client, which bypasses RLS.
