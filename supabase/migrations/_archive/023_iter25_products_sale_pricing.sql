-- ============================================================================
-- Iteration 25 — Webshop sale pricing.
-- ============================================================================
--
-- Goal: let admins put a product on sale for a bounded time window. The
-- public catalogue surfaces both the original price and the sale price, the
-- frontend decides what to show, and the server enforces the time window.
--
-- Race condition strategy: when a customer adds a product to their cart, we
-- snapshot the *currently effective* price into `cart_items.unit_price_snapshot`.
-- Checkout records `order_items.unit_price` from that snapshot, so a sale that
-- expires *between* add-to-cart and checkout still honours the sale price the
-- customer saw. Re-adding a variant later refreshes the snapshot to the current
-- effective price.
--
-- Notes
-- -----
-- - `sale_price` may be NULL (no sale).
-- - `sale_starts_at` / `sale_ends_at` may both be NULL — meaning "always on".
-- - A sale is *active* iff `sale_price IS NOT NULL` AND
--     (`sale_starts_at IS NULL` OR `now() >= sale_starts_at`) AND
--     (`sale_ends_at IS NULL`   OR `now() <  sale_ends_at`).
-- - CHECK constraints reject `sale_price >= price` and reversed time windows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sale columns on `products`
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS sale_starts_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sale_ends_at    TIMESTAMPTZ;

-- Re-runnable CHECK constraints. DROP-then-ADD so the migration is idempotent
-- across re-applies during local development.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sale_price_below_price_chk;
ALTER TABLE public.products
  ADD  CONSTRAINT products_sale_price_below_price_chk
       CHECK (sale_price IS NULL OR sale_price < price);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sale_window_chk;
ALTER TABLE public.products
  ADD  CONSTRAINT products_sale_window_chk
       CHECK (
         sale_starts_at IS NULL
         OR sale_ends_at IS NULL
         OR sale_starts_at < sale_ends_at
       );

-- Partial index for the admin "active + upcoming" sale list.
CREATE INDEX IF NOT EXISTS products_sale_active_idx
  ON public.products (sale_ends_at)
  WHERE sale_price IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Cart price snapshot
-- ----------------------------------------------------------------------------
-- Existing rows get a snapshot equal to the product's current price; the cart
-- POST endpoint always sets this column going forward so the default never
-- appears in production data.
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS unit_price_snapshot NUMERIC(10,2);

UPDATE public.cart_items ci
   SET unit_price_snapshot = pr.price
  FROM public.product_variants pv
  JOIN public.products pr ON pr.id = pv.product_id
 WHERE ci.variant_id = pv.id
   AND ci.unit_price_snapshot IS NULL;

ALTER TABLE public.cart_items
  ALTER COLUMN unit_price_snapshot SET NOT NULL;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_unit_price_snapshot_chk;
ALTER TABLE public.cart_items
  ADD  CONSTRAINT cart_items_unit_price_snapshot_chk
       CHECK (unit_price_snapshot >= 0);

-- ----------------------------------------------------------------------------
-- 3. checkout_order RPC — use the cart snapshot for order_items.unit_price.
-- ----------------------------------------------------------------------------
-- The previous version computed unit_price from products.price at checkout
-- time. We now read it from cart_items.unit_price_snapshot so an expired sale
-- between add-to-cart and checkout still honours the sale price.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.checkout_order(
  p_user_id          UUID,
  p_total_price      NUMERIC,
  p_shipping_address JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_count   INTEGER;
  v_order_id     UUID;
  v_items_count  INTEGER := 0;
  v_line         RECORD;
BEGIN
  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'A végösszeg nem lehet negatív' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
    FROM public.cart_items
   WHERE user_id = p_user_id
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_cart_count
    FROM public.cart_items
   WHERE user_id = p_user_id;

  IF v_cart_count = 0 THEN
    RAISE EXCEPTION 'A kosár üres' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
    FROM public.product_variants pv
   WHERE pv.id IN (
     SELECT variant_id FROM public.cart_items WHERE user_id = p_user_id
   )
   ORDER BY pv.id
   FOR UPDATE;

  FOR v_line IN
    SELECT ci.variant_id,
           ci.quantity AS qty,
           pv.stock    AS stock
      FROM public.cart_items ci
      JOIN public.product_variants pv ON pv.id = ci.variant_id
     WHERE ci.user_id = p_user_id
  LOOP
    IF v_line.qty > v_line.stock THEN
      RAISE EXCEPTION
        'Nincs elegendő készlet (variáns: %, elérhető: %)',
        v_line.variant_id, v_line.stock
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO public.orders (user_id, total_price, shipping_address, coupon_id)
  VALUES (p_user_id, p_total_price, p_shipping_address, NULL)
  RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT ci.variant_id,
           ci.quantity            AS qty,
           ci.unit_price_snapshot AS unit_price
      FROM public.cart_items ci
     WHERE ci.user_id = p_user_id
  LOOP
    INSERT INTO public.order_items (order_id, variant_id, quantity, unit_price)
    VALUES (v_order_id, v_line.variant_id, v_line.qty, v_line.unit_price);

    UPDATE public.product_variants
       SET stock = stock - v_line.qty
     WHERE id = v_line.variant_id;

    v_items_count := v_items_count + 1;
  END LOOP;

  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'total_price',  p_total_price,
    'items_count',  v_items_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.checkout_order(uuid, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.checkout_order(uuid, numeric, jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. recommended_products view — surface sale fields + effective_price.
-- ----------------------------------------------------------------------------
-- The view is consumed by /api/products/recommended. Adding the sale fields
-- keeps that endpoint consistent with /api/products and /api/products/[id].
-- ----------------------------------------------------------------------------

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
       p.sale_price,
       p.sale_starts_at,
       p.sale_ends_at,
       CASE
         WHEN p.sale_price IS NOT NULL
          AND (p.sale_starts_at IS NULL OR NOW() >= p.sale_starts_at)
          AND (p.sale_ends_at   IS NULL OR NOW() <  p.sale_ends_at)
         THEN p.sale_price
         ELSE p.price
       END                                   AS effective_price,
       (p.sale_price IS NOT NULL
         AND (p.sale_starts_at IS NULL OR NOW() >= p.sale_starts_at)
         AND (p.sale_ends_at   IS NULL OR NOW() <  p.sale_ends_at))
                                             AS is_on_sale,
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
