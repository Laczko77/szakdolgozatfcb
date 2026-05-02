-- ============================================================================
-- 019_iter23_supabase_warnings_fix.sql
--
-- Iteration 23 — Supabase Database Linter / Advisor warning remediation.
--
-- Fixes (high → low severity):
--   1. ERROR: security_definer_view  — recreate 5 views with security_invoker
--      so they execute under the calling user's RLS, not the view creator's.
--      Affected: page_view_counts_by_path, recommended_products,
--                product_view_counts, poll_results, coupon_redeem_stats.
--
--   2. WARN:  function_search_path_mutable — pin search_path on the two
--      remaining functions that lacked it (`set_updated_at`,
--      `polls_none_option_valid`). All other public functions already set it.
--
--   3. WARN:  anon_security_definer_function_executable
--             authenticated_security_definer_function_executable
--      Revoke EXECUTE from anon + authenticated on the SECURITY DEFINER RPCs
--      that are intended to be invoked exclusively by server-side API routes
--      via the service role:
--        _generate_coupon_code, redeem_coupon, apply_coupon_to_order,
--        consume_coupon, purchase_tickets, resolve_poll,
--        audit_rls_coverage, handle_new_user.
--
--      `is_admin()` and `is_mutual_follow()` are intentionally left callable
--      by anon/authenticated because they are referenced inside RLS USING
--      expressions and must be evaluatable in the caller's context. They
--      remain SECURITY DEFINER + pinned search_path which is the standard
--      Supabase hardening pattern for RLS helper functions.
--
--   4. WARN:  public_bucket_allows_listing — drop the redundant
--      "Public read <bucket>" SELECT policies on storage.objects for the 5
--      public buckets. Public buckets serve object URLs directly via the
--      Supabase CDN without any storage.objects policy; the policies were
--      only enabling LIST operations which we never use.
--
--   5. Coverage gap — add FK indexes that were missing on:
--        orders.coupon_id, point_transactions.poll_id, messages.sender_id.
--
--   6. Cascade for hard-delete coupon flow (Task 23.3): switch the
--      redeemed_coupons.coupon_id FK from ON DELETE RESTRICT to
--      ON DELETE CASCADE so DELETE FROM coupons can clean up its codes.
--
-- Idempotent: every drop / alter is guarded; safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Recreate views with security_invoker
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.coupon_redeem_stats;
CREATE VIEW public.coupon_redeem_stats
  WITH (security_invoker = on)
AS
SELECT c.id                                              AS coupon_id,
       COUNT(rc.id)::INTEGER                             AS redeemed_count,
       COUNT(rc.id) FILTER (WHERE rc.is_used)::INTEGER   AS used_count
  FROM public.coupons c
  LEFT JOIN public.redeemed_coupons rc ON rc.coupon_id = c.id
 GROUP BY c.id;

GRANT SELECT ON public.coupon_redeem_stats TO authenticated;

DROP VIEW IF EXISTS public.poll_results;
CREATE VIEW public.poll_results
  WITH (security_invoker = on)
AS
SELECT poll_id,
       selected_option,
       COUNT(*)::INTEGER AS vote_count
  FROM public.votes
 GROUP BY poll_id, selected_option;

GRANT SELECT ON public.poll_results TO anon, authenticated;

DROP VIEW IF EXISTS public.page_view_counts_by_path;
CREATE VIEW public.page_view_counts_by_path
  WITH (security_invoker = on)
AS
SELECT page_path,
       COUNT(*)::INTEGER AS view_count,
       MAX(created_at)   AS last_viewed_at
  FROM public.page_views
 GROUP BY page_path;

GRANT SELECT ON public.page_view_counts_by_path TO authenticated;

DROP VIEW IF EXISTS public.product_view_counts;
CREATE VIEW public.product_view_counts
  WITH (security_invoker = on)
AS
SELECT p.id                  AS product_id,
       p.name,
       p.image_url,
       p.price,
       p.category,
       COUNT(pv.id)::INTEGER AS view_count,
       MAX(pv.created_at)    AS last_viewed_at
  FROM public.products p
  LEFT JOIN public.page_views pv ON pv.product_id = p.id
 GROUP BY p.id, p.name, p.image_url, p.price, p.category;

GRANT SELECT ON public.product_view_counts TO authenticated;

DROP VIEW IF EXISTS public.recommended_products;
CREATE VIEW public.recommended_products
  WITH (security_invoker = on)
AS
WITH view_agg AS (
  SELECT product_id, COUNT(*)::INTEGER AS view_count
    FROM public.page_views
   WHERE product_id IS NOT NULL
   GROUP BY product_id
),
review_agg AS (
  SELECT product_id,
         AVG(rating)::NUMERIC(4,2) AS avg_rating,
         COUNT(*)::INTEGER         AS review_count
    FROM public.reviews
   WHERE is_visible = TRUE
   GROUP BY product_id
)
SELECT p.id                                  AS product_id,
       p.name,
       p.description,
       p.image_url,
       p.price,
       p.category,
       p.created_at,
       COALESCE(v.view_count, 0)             AS view_count,
       COALESCE(r.avg_rating, 0)             AS avg_rating,
       COALESCE(r.review_count, 0)           AS review_count,
       (COALESCE(v.view_count, 0)
         * COALESCE(r.avg_rating, 1) / 5.0
         + COALESCE(r.avg_rating, 0))        AS score
  FROM public.products p
  LEFT JOIN view_agg   v ON v.product_id = p.id
  LEFT JOIN review_agg r ON r.product_id = p.id;

GRANT SELECT ON public.recommended_products TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Pin search_path on the two remaining mutable-search_path functions.
-- ----------------------------------------------------------------------------

-- set_updated_at — generic BEFORE-UPDATE trigger function. Body references
-- only NEW which is sema-resolved by the trigger context, so an empty
-- search_path is sufficient.
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- polls_none_option_valid — touches only the JSONB argument and the
-- pg_catalog functions jsonb_typeof / jsonb_array_elements / count(*).
-- pg_catalog is always implicitly searched, so an empty search_path works.
ALTER FUNCTION public.polls_none_option_valid(jsonb) SET search_path = '';

-- ----------------------------------------------------------------------------
-- 3. Restrict SECURITY DEFINER RPC surface area.
--
-- These are invoked from server-side API routes using the service-role
-- client only. The frontend never calls them directly via /rest/v1/rpc.
-- Revoking from anon + authenticated closes the public RPC endpoint while
-- preserving server-side invocation.
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public._generate_coupon_code()                                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(uuid, uuid)                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_coupon_to_order(uuid, uuid, text)                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_coupon(uuid, text)                             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_tickets(uuid, uuid, integer)                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_poll(uuid, integer)                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_rls_coverage()                                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                      FROM anon, authenticated;

-- is_admin() and is_mutual_follow(uuid, uuid) are intentionally NOT revoked.
-- They are referenced from RLS USING/WITH CHECK expressions and must be
-- callable in the policy-evaluation context of the requesting role.

-- ----------------------------------------------------------------------------
-- 4. Drop redundant "Public read <bucket>" SELECT policies on storage.objects.
--
-- The 5 buckets are public (storage.buckets.public = true) — that flag
-- alone is what authorizes <https://...storage/v1/object/public/...> URLs.
-- The SELECT policies were only enabling storage.objects LIST (= bucket
-- enumeration) which the application does not use and which the linter
-- flags as data exposure.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  bucket_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH bucket_name IN ARRAY ARRAY[
    'profile-images',
    'article-images',
    'player-images',
    'product-images',
    'post-images'
  ]
  LOOP
    policy_name := 'Public read ' || bucket_name;
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      policy_name
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Add missing FK indexes.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS orders_coupon_idx
  ON public.orders(coupon_id);

CREATE INDEX IF NOT EXISTS point_transactions_poll_idx
  ON public.point_transactions(poll_id);

CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages(sender_id);

-- ----------------------------------------------------------------------------
-- 6. Cascade redeemed_coupons on coupon hard delete.
--
-- The original FK was ON DELETE RESTRICT to make accidental admin deletes
-- safe. With Task 23.3 (DELETE /api/admin/coupons/[id]/hard) we now have an
-- explicit, admin-guarded hard-delete endpoint, so cascading deletion of
-- the dependent redeemed_coupons rows is the desired behaviour. Soft delete
-- via PATCH .../[id] continues to set is_active = false and does not touch
-- the FK.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname
    INTO v_constraint_name
    FROM pg_constraint con
    JOIN pg_class      cl  ON cl.oid  = con.conrelid
    JOIN pg_namespace  ns  ON ns.oid  = cl.relnamespace
   WHERE ns.nspname = 'public'
     AND cl.relname = 'redeemed_coupons'
     AND con.contype = 'f'
     AND EXISTS (
       SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = cl.oid
          AND a.attnum   = ANY (con.conkey)
          AND a.attname  = 'coupon_id'
     );

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.redeemed_coupons DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;

  ALTER TABLE public.redeemed_coupons
    ADD CONSTRAINT redeemed_coupons_coupon_id_fkey
    FOREIGN KEY (coupon_id)
    REFERENCES public.coupons(id)
    ON DELETE CASCADE;
END $$;
