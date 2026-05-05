-- ============================================================================
-- 021_fix_security_definer_warnings.sql
--
-- Supabase Database Linter — remaining SECURITY DEFINER warnings.
--
-- Context:
--   Migrations 019 and 020 already revoked EXECUTE on several SECURITY DEFINER
--   functions from anon + authenticated. However the Supabase linter checks
--   effective privilege per concrete role via has_function_privilege(), which
--   still returns true when the PUBLIC pseudo-role holds the privilege (Postgres
--   grants EXECUTE to PUBLIC by default when a function is created, and an
--   explicit REVOKE FROM anon/authenticated does not strip the PUBLIC grant).
--
-- Functions addressed here:
--
--   1. handle_new_user()
--      Used only as an auth.users AFTER INSERT trigger. No direct caller ever
--      needs EXECUTE. REVOKE FROM PUBLIC closes the remaining gap. Stays
--      SECURITY DEFINER because the trigger must write to public.profiles
--      (no INSERT policy exists for users on that table).
--
--   2. checkout_order(uuid, numeric, jsonb)
--      Server-side only (service-role client in /api/checkout). Migration 012
--      did REVOKE ALL FROM PUBLIC + GRANT TO service_role, but 020 added the
--      explicit per-role revoke for completeness. REVOKE FROM PUBLIC here
--      ensures no residual privilege path remains.
--
--   3. is_mutual_follow(uuid, uuid)
--      Migration 015 issued REVOKE ALL FROM PUBLIC + GRANT TO authenticated,
--      service_role. Migration 018 redefined the function body with CREATE OR
--      REPLACE but did NOT repeat the privilege statements. In Postgres, CREATE
--      OR REPLACE preserves *explicit* grants but a prior REVOKE FROM PUBLIC
--      may not survive because default privileges can be re-applied. We
--      re-issue the REVOKE + GRANT pair to make it idempotent going forward.
--      Stays SECURITY DEFINER: the conversations INSERT policy calls this
--      function inside WITH CHECK; without DEFINER the function would run under
--      the caller's identity and might not be able to read both sides of the
--      follows table (pending-visibility RLS on follows).
--
--   4. is_admin()
--      Cannot be revoked from anon while the coupons SELECT policy uses
--        TO anon, authenticated USING (is_active = TRUE OR public.is_admin())
--      because Postgres evaluates the USING expression with the calling role's
--      privileges. Fix: split that policy into two separate policies so that
--      the anon branch never calls is_admin(). Afterwards is_admin() can be
--      revoked from PUBLIC and re-granted to authenticated + service_role only.
--      Stays SECURITY DEFINER: the function queries public.profiles; without
--      DEFINER a SELECT policy on profiles that calls is_admin() would cause
--      infinite recursion.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY + REVOKE/GRANT are all
-- safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. handle_new_user — revoke from PUBLIC
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 2. checkout_order — revoke from PUBLIC
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.checkout_order(uuid, numeric, jsonb) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 3. is_mutual_follow — re-issue full privilege set after 018 CREATE OR REPLACE
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.is_mutual_follow(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mutual_follow(uuid, uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. is_admin — split coupons policy, then revoke from PUBLIC
--
-- The original "coupons_select_active_public" policy applied to both anon and
-- authenticated with USING (is_active = TRUE OR public.is_admin()). Anon users
-- are never admins, so the OR branch is dead for them — but Postgres still
-- checks the privilege at policy-evaluation time, keeping anon callable on
-- is_admin(). Splitting into two policies removes the dead branch for anon.
-- ----------------------------------------------------------------------------

-- Remove the combined policy (covers both anon and authenticated).
DROP POLICY IF EXISTS "coupons_select_active_public" ON public.coupons;

-- Anon: only active coupons, no is_admin() call.
CREATE POLICY "coupons_select_active_anon"
  ON public.coupons
  FOR SELECT
  TO anon
  USING (is_active = TRUE);

-- Authenticated: active coupons OR admin (admin can see inactive ones too).
CREATE POLICY "coupons_select_active_or_admin"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE OR public.is_admin());

-- Now that no anon-targeted policy calls is_admin(), revoke from PUBLIC and
-- re-grant to authenticated + service_role.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
