-- ============================================================================
-- 008_iter8_rls_policies.sql
-- RLS additions for Iteration 8 (Közösségi Feed Backend).
--
-- Scope:
--   - posts:     INSERT/UPDATE/DELETE admin only. (SELECT was opened to public
--                in 007_iter7_rls_policies.sql.)
--   - comments:  public read; authenticated user can INSERT their own comment;
--                user can DELETE their own; admin can DELETE any (handled in a
--                second DELETE policy with USING is_admin()).
--   - reactions: public read; authenticated user can INSERT their own; user can
--                UPDATE/DELETE their own.
--
-- Idempotent: every policy is dropped IF EXISTS before being recreated.
-- RLS itself was already enabled by 002_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- posts  — admin write. Public SELECT lives in 007_iter7_rls_policies.sql.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "posts_insert_admin" ON public.posts;
CREATE POLICY "posts_insert_admin"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "posts_update_admin" ON public.posts;
CREATE POLICY "posts_update_admin"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "posts_delete_admin" ON public.posts;
CREATE POLICY "posts_delete_admin"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- comments
-- ============================================================================

DROP POLICY IF EXISTS "comments_select_public" ON public.comments;
CREATE POLICY "comments_select_public"
  ON public.comments
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Author can post a comment under their own user_id.
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Author deletes their own comment; admin deletes anything.
DROP POLICY IF EXISTS "comments_delete_own_or_admin" ON public.comments;
CREATE POLICY "comments_delete_own_or_admin"
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- reactions
-- ============================================================================

DROP POLICY IF EXISTS "reactions_select_public" ON public.reactions;
CREATE POLICY "reactions_select_public"
  ON public.reactions
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "reactions_insert_own" ON public.reactions;
CREATE POLICY "reactions_insert_own"
  ON public.reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- A user can swap their emoji on the same target — UPDATE allowed on own rows,
-- never on someone else's.
DROP POLICY IF EXISTS "reactions_update_own" ON public.reactions;
CREATE POLICY "reactions_update_own"
  ON public.reactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;
CREATE POLICY "reactions_delete_own"
  ON public.reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
