-- ============================================================================
-- 005_players_rls.sql
-- Row-Level Security policies for the `players` table.
--
-- Read: public (anonymous + authenticated). The squad page is unauthenticated.
-- Write: admin only — and in practice executed via the service-role client
-- by the /api/admin/players/sync and /api/admin/players/[id] route handlers.
--
-- Idempotent: every policy is dropped IF EXISTS before being recreated.
-- RLS itself was already enabled in 002_schema.sql.
-- The is_admin() helper was created in 004_rls_policies.sql.
-- ============================================================================

DROP POLICY IF EXISTS "players_select_all" ON public.players;
CREATE POLICY "players_select_all"
  ON public.players
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "players_insert_admin" ON public.players;
CREATE POLICY "players_insert_admin"
  ON public.players
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "players_update_admin" ON public.players;
CREATE POLICY "players_update_admin"
  ON public.players
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "players_delete_admin" ON public.players;
CREATE POLICY "players_delete_admin"
  ON public.players
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
