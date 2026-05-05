-- ============================================================================
-- 016_iter19_dream_teams.sql
-- Iteration 19 — Álomcsapat perzisztencia.
--
-- A drag-and-drop álomcsapat backend tárolása. A user mentheti a saját
-- csapatát (formáció + játékos elrendezés) és visszatöltheti. Megosztás nincs.
--
-- Limit: max 5 csapat / user (alkalmazás szinten kényszerítve a POST-ban,
-- hogy beszédes 400 üzenetet adjon — az RLS önmagában ezt nem oldja meg).
--
-- Idempotens: minden objektumot DROP IF EXISTS / IF NOT EXISTS előz meg.
-- ============================================================================

-- ============================================================================
-- 1. dream_teams
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dream_teams (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Álomcsapatom'
              CHECK (char_length(name) BETWEEN 1 AND 100),
  formation   TEXT NOT NULL
              CHECK (formation IN ('4-3-3', '4-2-3-1', '3-5-2', '4-4-2')),
  players     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dream_teams_user_id_idx
  ON public.dream_teams(user_id);

ALTER TABLE public.dream_teams ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- updated_at trigger
--
-- Újrahasznosítja a 002_schema.sql-ben definiált public.set_updated_at()
-- függvényt.
-- ============================================================================

DROP TRIGGER IF EXISTS dream_teams_set_updated_at ON public.dream_teams;
CREATE TRIGGER dream_teams_set_updated_at
  BEFORE UPDATE ON public.dream_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS — dream_teams
--
-- Privát adat: csak a tulajdonos olvashatja és módosíthatja.
-- ============================================================================

DROP POLICY IF EXISTS "dream_teams_select_own" ON public.dream_teams;
CREATE POLICY "dream_teams_select_own"
  ON public.dream_teams
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "dream_teams_insert_own" ON public.dream_teams;
CREATE POLICY "dream_teams_insert_own"
  ON public.dream_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dream_teams_update_own" ON public.dream_teams;
CREATE POLICY "dream_teams_update_own"
  ON public.dream_teams
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dream_teams_delete_own" ON public.dream_teams;
CREATE POLICY "dream_teams_delete_own"
  ON public.dream_teams
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
