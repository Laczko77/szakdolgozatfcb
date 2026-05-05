-- ============================================================================
-- 010_iter10_coupons.sql
-- RLS policies + RPCs for the Iteration 10 point-shop / coupon system.
--
-- Scope:
--   - coupons:          public read of active coupons, admin INSERT/UPDATE/DELETE.
--   - redeemed_coupons: user reads own; INSERT/UPDATE/DELETE forbidden in
--                       application code — all writes go through the SECURITY
--                       DEFINER RPCs below so we can keep balance/ledger
--                       updates atomic.
--   - point_transactions:
--                       coupon redemption inserts a -<point_cost> row with
--                       reason = 'coupon_redeem'. The 009 migration already
--                       handles the 'poll_win' case.
--
-- RPCs:
--   - redeem_coupon()         — point-shop redemption: charge points, mint code.
--   - apply_coupon_to_order() — webshop checkout: validate + mark used + link.
--   - consume_coupon()        — generic checkout (ticket purchase): validate + mark used.
--
-- Idempotent: every policy / function is dropped IF EXISTS before recreate.
-- RLS itself was already enabled by 002_schema.sql.
-- ============================================================================

-- ============================================================================
-- coupons  — public read (active only), admin write.
-- ============================================================================

DROP POLICY IF EXISTS "coupons_select_active_public" ON public.coupons;
CREATE POLICY "coupons_select_active_public"
  ON public.coupons
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "coupons_insert_admin" ON public.coupons;
CREATE POLICY "coupons_insert_admin"
  ON public.coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_update_admin" ON public.coupons;
CREATE POLICY "coupons_update_admin"
  ON public.coupons
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_delete_admin" ON public.coupons;
CREATE POLICY "coupons_delete_admin"
  ON public.coupons
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- redeemed_coupons
--
-- Read: a user can see their own rows; admins see everything.
-- Insert / Update / Delete: NO policy = deny. All writes flow through the
-- SECURITY DEFINER RPCs declared further down in this migration.
-- ============================================================================

DROP POLICY IF EXISTS "redeemed_coupons_select_own_or_admin" ON public.redeemed_coupons;
CREATE POLICY "redeemed_coupons_select_own_or_admin"
  ON public.redeemed_coupons
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- coupon_redeem_stats  — admin-facing aggregate view.
-- Counts how many times a coupon has been redeemed and how many of those
-- redemptions have been used. Used by GET /api/admin/coupons.
-- ============================================================================

CREATE OR REPLACE VIEW public.coupon_redeem_stats AS
SELECT c.id                                              AS coupon_id,
       COUNT(rc.id)::INTEGER                             AS redeemed_count,
       COUNT(rc.id) FILTER (WHERE rc.is_used)::INTEGER   AS used_count
  FROM public.coupons c
  LEFT JOIN public.redeemed_coupons rc ON rc.coupon_id = c.id
 GROUP BY c.id;

-- The view is restricted via the underlying tables' RLS plus an explicit grant.
-- We expose it only to authenticated users; the API route adds the admin guard.
GRANT SELECT ON public.coupon_redeem_stats TO authenticated;

-- ============================================================================
-- _generate_coupon_code()  — internal helper.
--
-- Produces a `BARCA-XXXX-XXXX` token where each X is from the alphabet
-- [A-Z0-9]. Cryptographically random via gen_random_bytes (pgcrypto). The
-- caller is responsible for retrying on UNIQUE collisions; redeemed_coupons.code
-- has a UNIQUE constraint that backstops the generator.
-- ============================================================================

DROP FUNCTION IF EXISTS public._generate_coupon_code();

CREATE OR REPLACE FUNCTION public._generate_coupon_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet  CONSTANT TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  alpha_len CONSTANT INTEGER := length(alphabet);
  out_text  TEXT := 'BARCA-';
  raw       BYTEA;
  i         INTEGER;
BEGIN
  raw := gen_random_bytes(8);
  FOR i IN 0..7 LOOP
    out_text := out_text
              || substr(alphabet,
                        (get_byte(raw, i) % alpha_len) + 1,
                        1);
    IF i = 3 THEN
      out_text := out_text || '-';
    END IF;
  END LOOP;
  RETURN out_text;
END;
$$;

REVOKE ALL ON FUNCTION public._generate_coupon_code() FROM PUBLIC;

-- ============================================================================
-- redeem_coupon()
--
-- Point-shop redemption flow. Atomically:
--   1. Locks the user_points row.
--   2. Validates the coupon (exists, is_active, point_cost <= balance).
--   3. Decrements user_points.balance.
--   4. Generates a unique BARCA-XXXX-XXXX code (retries on collision).
--   5. Inserts the redeemed_coupons row.
--   6. Inserts a -<point_cost> point_transactions ledger entry.
--
-- Returns: the redeemed_coupons row as JSONB.
--
-- Errors (SQLSTATE P0001):
--   - coupon not found / inactive
--   - insufficient points
--   - generator could not produce a unique code in N attempts (extremely rare)
-- ============================================================================

DROP FUNCTION IF EXISTS public.redeem_coupon(UUID, UUID);

CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_user_id   UUID,
  p_coupon_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon       public.coupons%ROWTYPE;
  v_balance      INTEGER;
  v_code         TEXT;
  v_redeemed_id  UUID;
  v_redeemed     public.redeemed_coupons%ROWTYPE;
  v_attempts     INTEGER := 0;
BEGIN
  -- Lock + load the user's points row first to serialize concurrent redeems.
  -- Defensively create a zeroed row if the trigger never inserted one.
  INSERT INTO public.user_points (user_id, balance, total_earned)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance
    INTO v_balance
    FROM public.user_points
   WHERE user_id = p_user_id
   FOR UPDATE;

  -- Load + validate the coupon.
  SELECT *
    INTO v_coupon
    FROM public.coupons
   WHERE id = p_coupon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott kupon nem található'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_coupon.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'A kupon nem érhető el'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_balance < v_coupon.point_cost THEN
    RAISE EXCEPTION 'Nincs elég pontod a beváltáshoz (egyenleg: %, ár: %)',
      v_balance, v_coupon.point_cost
      USING ERRCODE = 'P0001';
  END IF;

  -- Charge points.
  UPDATE public.user_points
     SET balance = balance - v_coupon.point_cost
   WHERE user_id = p_user_id;

  -- Generate a unique code. UNIQUE(code) backstops collisions; we retry up
  -- to 10 times before giving up.
  LOOP
    v_attempts := v_attempts + 1;
    v_code := public._generate_coupon_code();

    BEGIN
      INSERT INTO public.redeemed_coupons (user_id, coupon_id, code, is_used)
      VALUES (p_user_id, p_coupon_id, v_code, FALSE)
      RETURNING id INTO v_redeemed_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 10 THEN
        RAISE EXCEPTION 'Nem sikerült egyedi kuponkódot generálni'
          USING ERRCODE = 'P0001';
      END IF;
      -- Otherwise loop and retry.
    END;
  END LOOP;

  -- Ledger entry (negative amount; total_earned untouched per project rule).
  INSERT INTO public.point_transactions (user_id, amount, reason, poll_id)
  VALUES (p_user_id, -v_coupon.point_cost, 'coupon_redeem', NULL);

  -- Return the freshly created row.
  SELECT *
    INTO v_redeemed
    FROM public.redeemed_coupons
   WHERE id = v_redeemed_id;

  RETURN to_jsonb(v_redeemed);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(UUID, UUID) TO service_role;

-- ============================================================================
-- apply_coupon_to_order()
--
-- Webshop-checkout flow. Atomically:
--   1. Looks up the redeemed_coupons row by code, FOR UPDATE.
--   2. Verifies ownership and is_used = false.
--   3. Loads the linked coupon definition (discount_type / discount_value).
--   4. Marks redeemed_coupons.is_used = true.
--   5. Sets orders.coupon_id = redeemed_coupons.id.
--
-- Returns: { redeemed_id, coupon_id, discount_type, discount_value }
--          — the API layer applies the discount math against the order total.
--
-- Errors (SQLSTATE P0001):
--   - code not found
--   - code does not belong to caller
--   - code already used
--   - order not found / not owned by caller
-- ============================================================================

DROP FUNCTION IF EXISTS public.apply_coupon_to_order(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.apply_coupon_to_order(
  p_order_id UUID,
  p_user_id  UUID,
  p_code     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redeemed public.redeemed_coupons%ROWTYPE;
  v_coupon   public.coupons%ROWTYPE;
  v_order_user UUID;
BEGIN
  -- Verify the order exists and belongs to this user.
  SELECT user_id INTO v_order_user
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A rendelés nem található'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_order_user IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'A rendelés nem ehhez a felhasználóhoz tartozik'
      USING ERRCODE = 'P0001';
  END IF;

  -- Look up + lock the coupon code.
  SELECT *
    INTO v_redeemed
    FROM public.redeemed_coupons
   WHERE code = p_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott kuponkód érvénytelen'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.user_id <> p_user_id THEN
    RAISE EXCEPTION 'A kuponkód nem ehhez a felhasználóhoz tartozik'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.is_used THEN
    RAISE EXCEPTION 'A kuponkód már fel lett használva'
      USING ERRCODE = 'P0001';
  END IF;

  -- Load the coupon definition.
  SELECT *
    INTO v_coupon
    FROM public.coupons
   WHERE id = v_redeemed.coupon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A kuponhoz tartozó leírás nem található'
      USING ERRCODE = 'P0001';
  END IF;

  -- Mark the code used and link it to the order.
  UPDATE public.redeemed_coupons
     SET is_used = TRUE
   WHERE id = v_redeemed.id;

  UPDATE public.orders
     SET coupon_id = v_redeemed.id
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'redeemed_id',    v_redeemed.id,
    'coupon_id',      v_coupon.id,
    'discount_type',  v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_coupon_to_order(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_coupon_to_order(UUID, UUID, TEXT) TO service_role;

-- ============================================================================
-- consume_coupon()
--
-- Generic single-shot consumption used outside the orders table (e.g. ticket
-- purchase flow). Validates ownership + freshness, marks is_used = true, and
-- returns the discount metadata. Does NOT link to any order row.
--
-- Errors (SQLSTATE P0001):
--   - code not found
--   - code does not belong to caller
--   - code already used
-- ============================================================================

DROP FUNCTION IF EXISTS public.consume_coupon(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.consume_coupon(
  p_user_id UUID,
  p_code    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redeemed public.redeemed_coupons%ROWTYPE;
  v_coupon   public.coupons%ROWTYPE;
BEGIN
  SELECT *
    INTO v_redeemed
    FROM public.redeemed_coupons
   WHERE code = p_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott kuponkód érvénytelen'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.user_id <> p_user_id THEN
    RAISE EXCEPTION 'A kuponkód nem ehhez a felhasználóhoz tartozik'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.is_used THEN
    RAISE EXCEPTION 'A kuponkód már fel lett használva'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
    INTO v_coupon
    FROM public.coupons
   WHERE id = v_redeemed.coupon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A kuponhoz tartozó leírás nem található'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.redeemed_coupons
     SET is_used = TRUE
   WHERE id = v_redeemed.id;

  RETURN jsonb_build_object(
    'redeemed_id',    v_redeemed.id,
    'coupon_id',      v_coupon.id,
    'discount_type',  v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_coupon(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_coupon(UUID, TEXT) TO service_role;
