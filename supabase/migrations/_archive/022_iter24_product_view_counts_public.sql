-- ============================================================================
-- Iteration 24 — Product view-count aggregate exposed to the public API.
-- ============================================================================
--
-- Goal: let the public webshop list (/api/products) sort by popularity and
-- surface the top-3 most-viewed products without leaking row-level access to
-- the page_views table (which is admin-read-only by RLS).
--
-- Why a SECURITY DEFINER RPC and not a view:
--   The existing `product_view_counts` view runs with `security_invoker = on`,
--   so reads are subject to the caller's RLS on `page_views` — and that table
--   only allows admins to SELECT. A SECURITY DEFINER function lets us expose
--   the *aggregate* (and only the aggregate) to anon/authenticated callers
--   without opening the underlying row data.
--
-- Index addition: the existing `page_views_product_idx` covers `product_id`
-- alone. The composite `(product_id, created_at DESC) WHERE product_id IS
-- NOT NULL` is better suited for product-aggregation queries that may also
-- want recency (and trims out non-product rows entirely).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Composite/partial index for product-scoped aggregations.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS page_views_product_created_idx
  ON public.page_views (product_id, created_at DESC)
  WHERE product_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Public RPC: aggregate view-counts by product_id.
--    Returns one row per product that has ever been viewed (NULL product_id
--    rows are filtered out). Callers JOIN this with the products table.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_view_counts()
RETURNS TABLE (
  product_id UUID,
  view_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT product_id,
         COUNT(*)::INTEGER AS view_count
    FROM public.page_views
   WHERE product_id IS NOT NULL
   GROUP BY product_id;
$$;

REVOKE ALL ON FUNCTION public.get_product_view_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_view_counts() TO anon, authenticated;

COMMENT ON FUNCTION public.get_product_view_counts() IS
  'Iter24: public aggregate of page_views grouped by product_id. SECURITY DEFINER so anon callers can read the aggregate without seeing raw page_views rows.';
