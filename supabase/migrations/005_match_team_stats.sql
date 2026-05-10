-- ============================================================================
-- 005_match_team_stats.sql
-- Permanens meccs csapatstatisztika tábla (api-football.com forrásból).
-- Lejátszott meccsek adatai nem változnak — nincs TTL, nincs cache logika.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.match_team_stats (
  football_data_match_id  INTEGER PRIMARY KEY,
  apifootball_fixture_id  INTEGER,
  home_possession         NUMERIC(5,2),
  away_possession         NUMERIC(5,2),
  home_shots              INTEGER,
  away_shots              INTEGER,
  home_shots_on_target    INTEGER,
  away_shots_on_target    INTEGER,
  home_corners            INTEGER,
  away_corners            INTEGER,
  home_fouls              INTEGER,
  away_fouls              INTEGER,
  home_pass_accuracy      NUMERIC(5,2),
  away_pass_accuracy      NUMERIC(5,2),
  fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.match_team_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_team_stats_select_all" ON public.match_team_stats;
CREATE POLICY "match_team_stats_select_all"
  ON public.match_team_stats FOR SELECT
  USING (true);
