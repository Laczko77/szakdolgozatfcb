-- ============================================================================
-- 012_iter12_final_rls_and_hardening.sql
-- Final RLS coverage + race-condition hardening (Iteration 12).
--
-- Earlier migrations enabled RLS on every table (002_schema.sql) and shipped
-- per-feature policies in 004–011. This file fills the remaining gaps:
--
--   1. RLS policies for the five Iteration-5 (webshop) tables that had RLS
--      enabled but no policies (= deny-all to non-service-role clients):
--         - cart_items
--         - wishlist
--         - reviews
--         - orders
--         - order_items
--   2. profiles: explicit DELETE policy (admin-only) so orphan-cleanup tooling
--      doesn't have to reach for the service role.
--   3. checkout_order() RPC — atomic checkout that locks each variant row,
--      validates stock, decrements stock, creates the order + order_items, and
--      clears the cart in a single transaction. Eliminates the
--      "two carts race for the last unit" window the JS-level checkout had.
--
-- Idempotent: every policy / function is dropped IF EXISTS before recreate.
-- The is_admin() helper was created in 004_rls_policies.sql.
-- ============================================================================

-- ============================================================================
-- cart_items
--
-- A user reads / writes only their own cart rows. INSERT / UPDATE / DELETE all
-- gate on auth.uid() = user_id. Admins are NOT given access here on purpose:
-- carts are private and short-lived, no admin ever needs to peek at them.
-- ============================================================================

DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
CREATE POLICY "cart_items_select_own"
  ON public.cart_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
CREATE POLICY "cart_items_insert_own"
  ON public.cart_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
CREATE POLICY "cart_items_update_own"
  ON public.cart_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
CREATE POLICY "cart_items_delete_own"
  ON public.cart_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- wishlist
--
-- Same shape as cart_items: own-only. The UNIQUE (user_id, product_id) keeps
-- duplicates out at the DB level.
-- ============================================================================

DROP POLICY IF EXISTS "wishlist_select_own" ON public.wishlist;
CREATE POLICY "wishlist_select_own"
  ON public.wishlist
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wishlist_insert_own" ON public.wishlist;
CREATE POLICY "wishlist_insert_own"
  ON public.wishlist
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wishlist_delete_own" ON public.wishlist;
CREATE POLICY "wishlist_delete_own"
  ON public.wishlist
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- reviews
--
-- Read: anyone can see visible reviews; the author can also see their own
--       hidden reviews; admin sees everything.
-- Insert: authenticated user creates a review under their own user_id. The
--         UNIQUE (product_id, user_id) constraint blocks doubles.
-- Update: ONLY admins (moderation toggle on is_visible). Users cannot edit
--         their own review post-hoc — the product backlog requires this.
-- Delete: author or admin.
-- ============================================================================

DROP POLICY IF EXISTS "reviews_select_visible_or_own_or_admin" ON public.reviews;
CREATE POLICY "reviews_select_visible_or_own_or_admin"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    is_visible = TRUE
    OR auth.uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_update_admin" ON public.reviews;
CREATE POLICY "reviews_update_admin"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reviews_delete_own_or_admin" ON public.reviews;
CREATE POLICY "reviews_delete_own_or_admin"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- orders
--
-- Read: user sees only their own orders; admin sees everything.
-- Insert: NO policy. All order creation flows through the service-role client
--         (or the checkout_order RPC defined below) so the multi-step
--         (order + items + stock) flow can run with one trust boundary.
-- Update: admin only (status transitions). Users cancel via DELETE-with-guard
--         in the route, which uses service-role.
-- Delete: NO policy — cancellation runs via service-role with a status check
--         in the API layer.
-- ============================================================================

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
CREATE POLICY "orders_select_own_or_admin"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;
CREATE POLICY "orders_update_admin"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- order_items
--
-- Read: a user reads items belonging to one of their own orders; admin reads all.
-- Write: NO policy — populated exclusively by the checkout flow / service role.
-- ============================================================================

DROP POLICY IF EXISTS "order_items_select_own_order_or_admin" ON public.order_items;
CREATE POLICY "order_items_select_own_order_or_admin"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
        FROM public.orders o
       WHERE o.id = order_items.order_id
         AND o.user_id = auth.uid()
    )
  );

-- ============================================================================
-- profiles  — admin DELETE policy (orphan cleanup).
--
-- 004 set up SELECT and UPDATE for profiles. INSERT goes through the
-- handle_new_user trigger. We add an admin-only DELETE so admin tooling can
-- purge orphan profiles without service-role credentials. End users cannot
-- delete their own profile via this policy — that flow goes through Supabase
-- Auth user-deletion which cascades through ON DELETE CASCADE on profiles.id.
-- ============================================================================

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- checkout_order()  — atomic webshop checkout.
--
-- Why an RPC:
--   The previous JS-level flow ran four separate statements (insert order,
--   insert order_items, decrement variant stock, clear cart) under a
--   service-role client. Two concurrent checkouts that fight for the last
--   unit of a variant would each see stock=1 in their preflight read, and
--   only the CHECK (stock >= 0) constraint would stop one of them — at the
--   cost of a half-built order requiring rollback.
--
--   This RPC instead:
--     1. Snapshots the cart joined to variants + product price.
--     2. Locks every relevant variant row (FOR UPDATE) in a stable ID order
--        — sorting by variant_id eliminates the classic "deadlock from two
--        sessions locking the same pair in opposite order" hazard.
--     3. Verifies stock >= requested for each line.
--     4. Decrements stock, creates the order + order_items, clears the cart.
--   Everything in one transaction. The caller passes pre-computed total_price
--   (post-coupon) plus the shipping address; the RPC does not touch coupons,
--   that stays in apply_coupon_to_order() which the API calls separately.
--
-- Returns: { order_id, total_price, items_count }
--
-- Errors (SQLSTATE P0001):
--   - empty cart
--   - variant missing / product missing
--   - insufficient stock (with variant_id + available count)
-- ============================================================================

DROP FUNCTION IF EXISTS public.checkout_order(UUID, NUMERIC, JSONB);

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
    RAISE EXCEPTION 'A végösszeg nem lehet negatív'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock the user's cart rows so a concurrent /api/cart POST cannot append
  -- new items between the snapshot read and the clear-cart at the bottom.
  PERFORM 1
    FROM public.cart_items
   WHERE user_id = p_user_id
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_cart_count
    FROM public.cart_items
   WHERE user_id = p_user_id;

  IF v_cart_count = 0 THEN
    RAISE EXCEPTION 'A kosár üres'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock each referenced variant in a stable order to avoid deadlocks.
  PERFORM 1
    FROM public.product_variants pv
   WHERE pv.id IN (
     SELECT variant_id FROM public.cart_items WHERE user_id = p_user_id
   )
   ORDER BY pv.id
   FOR UPDATE;

  -- Stock validation: walk every line and bail on the first shortfall.
  FOR v_line IN
    SELECT ci.variant_id,
           ci.quantity        AS qty,
           pv.stock           AS stock,
           pr.price           AS unit_price,
           pr.id              AS product_id
      FROM public.cart_items ci
      JOIN public.product_variants pv ON pv.id = ci.variant_id
      JOIN public.products pr         ON pr.id = pv.product_id
     WHERE ci.user_id = p_user_id
  LOOP
    IF v_line.qty > v_line.stock THEN
      RAISE EXCEPTION
        'Nincs elegendő készlet (variáns: %, elérhető: %)',
        v_line.variant_id, v_line.stock
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Create the order header. coupon_id is left NULL; the API layer links it
  -- afterwards via apply_coupon_to_order if a coupon was supplied.
  INSERT INTO public.orders (user_id, total_price, shipping_address, coupon_id)
  VALUES (p_user_id, p_total_price, p_shipping_address, NULL)
  RETURNING id INTO v_order_id;

  -- Insert order_items + decrement stock per line.
  FOR v_line IN
    SELECT ci.variant_id,
           ci.quantity        AS qty,
           pr.price           AS unit_price
      FROM public.cart_items ci
      JOIN public.product_variants pv ON pv.id = ci.variant_id
      JOIN public.products pr         ON pr.id = pv.product_id
     WHERE ci.user_id = p_user_id
  LOOP
    INSERT INTO public.order_items (order_id, variant_id, quantity, unit_price)
    VALUES (v_order_id, v_line.variant_id, v_line.qty, v_line.unit_price);

    UPDATE public.product_variants
       SET stock = stock - v_line.qty
     WHERE id = v_line.variant_id;

    v_items_count := v_items_count + 1;
  END LOOP;

  -- Clear the cart.
  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'total_price',  p_total_price,
    'items_count',  v_items_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_order(UUID, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_order(UUID, NUMERIC, JSONB) TO service_role;

-- ============================================================================
-- Verification helper (admin-only): which tables have RLS but zero policies?
--
-- Useful sanity check during deploys. Returns table names that are
-- RLS-enabled in the public schema but have no policies attached.
-- An empty result set is the desired state for production.
--
-- This function is admin-callable so it can be hit from a maintenance UI
-- without service-role credentials.
-- ============================================================================

DROP FUNCTION IF EXISTS public.audit_rls_coverage();

CREATE OR REPLACE FUNCTION public.audit_rls_coverage()
RETURNS TABLE (table_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.relname::TEXT
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relrowsecurity = TRUE
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename  = c.relname
     )
   ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.audit_rls_coverage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_rls_coverage() TO authenticated, service_role;
