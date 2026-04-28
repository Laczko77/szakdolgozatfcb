-- ----------------------------------------------------------------------------
-- Iter 15: standings_cache + scorers_cache
--
-- The dashboard widgets (La Liga table + top scorers) are served by two
-- public endpoints that proxy football-data.org. The free tier of that API
-- allows only 10 requests/minute, so we MUST cache the responses; otherwise
-- a handful of dashboard visitors per minute would lock us out for everyone.
--
-- Both tables are unique on (competition_id, season) — at most one cache row
-- per competition+season combination, refreshed via UPSERT.
--
-- RLS: anyone (anon + authenticated) can SELECT cached rows (the dashboard
-- is fully public). Only the service-role key can INSERT / UPDATE / DELETE,
-- which means cache writes only happen through our own API routes.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.standings_cache (
  id              SERIAL PRIMARY KEY,
  competition_id  INTEGER     NOT NULL,
  season          INTEGER     NOT NULL,
  data            JSONB       NOT NULL,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, season)
);

CREATE TABLE IF NOT EXISTS public.scorers_cache (
  id              SERIAL PRIMARY KEY,
  competition_id  INTEGER     NOT NULL,
  season          INTEGER     NOT NULL,
  data            JSONB       NOT NULL,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, season)
);

ALTER TABLE public.standings_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorers_cache  ENABLE ROW LEVEL SECURITY;

-- ---- standings_cache: public read, service-role only write ------------------

DROP POLICY IF EXISTS "standings_cache_select_public" ON public.standings_cache;
CREATE POLICY "standings_cache_select_public"
  ON public.standings_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies => only the service-role key (which
-- bypasses RLS) can write. This is intentional: the public endpoints use
-- the service-role client for cache writes after a successful upstream
-- fetch, and the admin invalidate endpoint deletes via the same client.

-- ---- scorers_cache: same shape ---------------------------------------------

DROP POLICY IF EXISTS "scorers_cache_select_public" ON public.scorers_cache;
CREATE POLICY "scorers_cache_select_public"
  ON public.scorers_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);
