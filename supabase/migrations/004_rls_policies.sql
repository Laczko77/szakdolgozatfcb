-- ============================================================================
-- 004_rls_policies.sql
-- Foundational Row-Level Security policies for Iteration 2.
--
-- Scope (this migration only): profiles, articles, products, product_variants,
-- user_points. Policies for the remaining 19 tables ship in later iterations
-- alongside the features that need them.
--
-- Idempotent: every policy is dropped IF EXISTS before being recreated.
-- RLS itself was already enabled by 002_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_admin()  — small helper used inside policy USING/WITH CHECK clauses.
--
-- STABLE so Postgres can cache the result inside a single statement, which
-- matters because RLS evaluates per-row. Marked SECURITY DEFINER so the
-- self-lookup against public.profiles bypasses the (recursive) profiles RLS
-- that we are about to define — without DEFINER, "SELECT role FROM profiles"
-- inside a profiles policy would loop.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ============================================================================
-- profiles
-- ============================================================================

-- Users see their own row; admins see everything.
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- Users update only their own row. We do NOT let users self-promote: the
-- WITH CHECK clause forbids changing role away from its current value.
-- Admins update anyone (including role).
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- INSERT is intentionally NOT policy-allowed: handle_new_user() runs as
-- SECURITY DEFINER and bypasses RLS, so client INSERTs are blocked by default
-- (no permissive policy = deny).

-- ============================================================================
-- articles  — public read, admin write.
-- ============================================================================

DROP POLICY IF EXISTS "articles_select_public" ON public.articles;
CREATE POLICY "articles_select_public"
  ON public.articles
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "articles_insert_admin" ON public.articles;
CREATE POLICY "articles_insert_admin"
  ON public.articles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "articles_update_admin" ON public.articles;
CREATE POLICY "articles_update_admin"
  ON public.articles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "articles_delete_admin" ON public.articles;
CREATE POLICY "articles_delete_admin"
  ON public.articles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- products  — public read, admin write.
-- ============================================================================

DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- product_variants  — public read, admin write.
-- ============================================================================

DROP POLICY IF EXISTS "product_variants_select_public" ON public.product_variants;
CREATE POLICY "product_variants_select_public"
  ON public.product_variants
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "product_variants_insert_admin" ON public.product_variants;
CREATE POLICY "product_variants_insert_admin"
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_variants_update_admin" ON public.product_variants;
CREATE POLICY "product_variants_update_admin"
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_variants_delete_admin" ON public.product_variants;
CREATE POLICY "product_variants_delete_admin"
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- user_points
--
-- Read: user sees only their own balance; admins see all.
-- Write (INSERT/UPDATE): no policy = deny. Mutations are performed via:
--   - the handle_new_user() trigger (SECURITY DEFINER, bypasses RLS),
--   - admin RPCs / API routes that use the service role client.
-- ============================================================================

DROP POLICY IF EXISTS "user_points_select_own_or_admin" ON public.user_points;
CREATE POLICY "user_points_select_own_or_admin"
  ON public.user_points
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());
