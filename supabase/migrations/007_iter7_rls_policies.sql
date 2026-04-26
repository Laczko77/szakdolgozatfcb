-- ============================================================================
-- 007_iter7_rls_policies.sql
-- RLS additions for Iteration 7 (Profilkezelés & Globális Kereső).
--
-- Scope:
--   - point_transactions: user reads own ledger; admins read all.
--   - posts: public read (the global search endpoint queries posts; making
--            this read-public also unblocks Iteration 8 at no cost. Iteration
--            8 will additionally introduce admin-only INSERT/UPDATE/DELETE).
--
-- Idempotent: every policy is dropped IF EXISTS before being recreated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- point_transactions  — read-own / admin-read-all.
-- INSERT/UPDATE/DELETE: no policy = deny (handled via service-role from
-- vote-resolution and coupon-redeem flows in later iterations).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "point_transactions_select_own_or_admin" ON public.point_transactions;
CREATE POLICY "point_transactions_select_own_or_admin"
  ON public.point_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ----------------------------------------------------------------------------
-- posts  — public read (anon + authenticated).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "posts_select_public" ON public.posts;
CREATE POLICY "posts_select_public"
  ON public.posts
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);
