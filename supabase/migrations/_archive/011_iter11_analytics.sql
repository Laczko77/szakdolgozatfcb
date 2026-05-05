-- ============================================================================
-- 011_iter11_analytics.sql
-- RLS policies + analytics views for Iteration 11 (cookie tracking + admin
-- analytics).
--
-- Scope:
--   - cookie_consents: anyone may INSERT/UPDATE their own cookie record (via
--                      the API which goes through the service-role client);
--                      only admins may SELECT.
--   - page_views:      anyone may INSERT (gated by consent in the API layer);
--                      only admins may SELECT.
--   - Aggregate views used by the admin analytics endpoints:
--       * page_view_counts_by_path
--       * product_view_counts
--       * recommended_products
--
-- Idempotent: every policy / view is dropped IF EXISTS before recreate.
-- RLS itself was already enabled by 002_schema.sql.
-- ============================================================================

-- ============================================================================
-- cookie_consents
--
-- Writes happen through the API's service-role client so we don't need
-- per-row INSERT/UPDATE policies for end users. We still expose a SELECT
-- policy for admins so they can audit consent state in dashboards if needed.
-- ============================================================================

DROP POLICY IF EXISTS "cookie_consents_select_admin" ON public.cookie_consents;
CREATE POLICY "cookie_consents_select_admin"
  ON public.cookie_consents
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: regular clients cannot write directly.
-- The /api/consent route uses createServiceRoleClient() to bypass RLS for
-- the upsert, which is the only sanctioned write path.

-- ============================================================================
-- page_views
--
-- Same pattern as cookie_consents: writes go through the service-role client
-- in /api/tracking/pageview after the consent check, and only admins can read.
-- ============================================================================

DROP POLICY IF EXISTS "page_views_select_admin" ON public.page_views;
CREATE POLICY "page_views_select_admin"
  ON public.page_views
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- page_view_counts_by_path
--
-- Aggregate view: how many views each page_path has received.
-- The admin route applies an optional date-range filter on top of this view's
-- underlying table, so the view itself stays time-agnostic.
-- ============================================================================

DROP VIEW IF EXISTS public.page_view_counts_by_path;
CREATE VIEW public.page_view_counts_by_path AS
SELECT page_path,
       COUNT(*)::INTEGER       AS view_count,
       MAX(created_at)         AS last_viewed_at
  FROM public.page_views
 GROUP BY page_path;

GRANT SELECT ON public.page_view_counts_by_path TO authenticated;

-- ============================================================================
-- product_view_counts
--
-- Aggregate view: how many views each product has received.
-- Joined back to products so the admin endpoint can return display data
-- (name, image, price) without a follow-up query.
-- ============================================================================

DROP VIEW IF EXISTS public.product_view_counts;
CREATE VIEW public.product_view_counts AS
SELECT p.id              AS product_id,
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

-- ============================================================================
-- recommended_products
--
-- Combines view counts with average review rating to surface "popular and
-- well-loved" products for the public recommendation endpoint. Reviews must
-- be visible (admin-moderated). NULL ratings (no reviews yet) sort below
-- products with any rating signal.
--
-- Ranking is intentionally simple: score = view_count * (avg_rating / 5).
-- Products with zero views fall back to a small base score so brand-new
-- products with reviews still surface above completely-unseen ones.
-- ============================================================================

DROP VIEW IF EXISTS public.recommended_products;
CREATE VIEW public.recommended_products AS
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
