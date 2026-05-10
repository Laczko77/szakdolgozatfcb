-- ============================================================================
-- 006_team_aggregate_caches.sql
-- Cache táblák a csapat-szintű Sofascore aggregátumokhoz:
--   - team_stats_cache       szezon-szintű csapatstatisztika (24h TTL)
--   - team_transfers_cache   átigazolási feed (24h TTL, singleton row)
--
-- Pattern: kompatibilis a season_evolution_cache / season_form_cache /
-- match_details_cache tábláival — JSONB payload + cache_key + cached_at.
-- TTL-t a route-ok számolnak `cached_at` alapján.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_stats_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  TEXT NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_transfers_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  TEXT NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.team_stats_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_transfers_cache ENABLE ROW LEVEL SECURITY;

-- Publikus olvasás (a többi cache táblához igazodva). Írni csak a
-- service-role kliens tud — a route handlerek azt használják.
DROP POLICY IF EXISTS "team_stats_cache_select_public" ON public.team_stats_cache;
CREATE POLICY "team_stats_cache_select_public"
  ON public.team_stats_cache FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "team_transfers_cache_select_public" ON public.team_transfers_cache;
CREATE POLICY "team_transfers_cache_select_public"
  ON public.team_transfers_cache FOR SELECT TO anon, authenticated USING (TRUE);
