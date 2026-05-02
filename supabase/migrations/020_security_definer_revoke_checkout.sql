-- ============================================================================
-- 020_security_definer_revoke_checkout.sql
--
-- Supabase Database Linter remediation — checkout_order SECURITY DEFINER
-- callable by anon / authenticated via /rest/v1/rpc.
--
-- Root cause:
--   Migration 012 issued:
--     REVOKE ALL ON FUNCTION public.checkout_order(...) FROM PUBLIC;
--     GRANT  EXECUTE ON FUNCTION public.checkout_order(...) TO service_role;
--
--   "REVOKE ... FROM PUBLIC" withdraws the privilege from the special PUBLIC
--   pseudo-role, but the Supabase linter evaluates effective privileges per
--   concrete role. The `authenticated` and `anon` roles may still inherit
--   EXECUTE through the PUBLIC default-privilege chain that Postgres applies
--   before the explicit revoke, depending on when default privileges were
--   granted relative to the function creation.
--
-- Fix: explicit REVOKE from anon and authenticated in addition to PUBLIC,
--   mirroring the pattern used in migration 019 for the other SECURITY
--   DEFINER functions.
--
-- checkout_order is invoked exclusively from /api/checkout server-side
-- using the service-role client — no anon or authenticated caller ever
-- needs to reach it via the REST API.
-- ============================================================================

REVOKE EXECUTE
  ON FUNCTION public.checkout_order(uuid, numeric, jsonb)
  FROM anon, authenticated;
