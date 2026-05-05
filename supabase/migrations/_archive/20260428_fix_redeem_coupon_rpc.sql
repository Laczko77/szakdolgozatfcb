-- ============================================================================
-- 20260428_fix_redeem_coupon_rpc.sql
--
-- Bug fix (Iteration 20, Task 20.2)
--
-- The original `_generate_coupon_code()` from migration 010_iter10_coupons.sql
-- used `gen_random_bytes(8)` which is provided by the `pgcrypto` extension.
-- That extension is NOT enabled by default on Supabase projects, so calls to
-- `redeem_coupon()` failed with:
--
--     ERROR:  function gen_random_bytes(integer) does not exist
--
-- Fix: rewrite the generator on top of `gen_random_uuid()` (built-in to
-- PostgreSQL 13+; always available on Supabase) and produce a token of the
-- same `BARCA-XXXX-XXXX` shape used elsewhere in the application. The
-- alphabet shrinks from [A-Z0-9] to hex [0-9A-F] but the slot count is
-- unchanged (8 random hex chars → ~16^8 combinations), and the column-level
-- UNIQUE(code) constraint plus the 10-attempt retry loop in `redeem_coupon`
-- still backstops collisions.
--
-- IMPORTANT: This migration must be applied manually against the Supabase
-- project (Supabase SQL editor or `supabase db push`). The runtime cannot
-- run migrations on the developer's behalf.
--
-- Idempotent: CREATE OR REPLACE on both functions; signatures unchanged so
-- existing GRANTs survive.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- _generate_coupon_code()
--
-- Returns a `BARCA-XXXX-XXXX` token where each X is a hex character drawn
-- from `gen_random_uuid()`. Two independent UUIDs are used so the two
-- 4-character segments are statistically independent.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._generate_coupon_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'BARCA-'
       || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4))
       || '-'
       || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4));
END;
$$;

REVOKE ALL ON FUNCTION public._generate_coupon_code() FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- redeem_coupon(p_user_id UUID, p_coupon_id UUID)
--
-- Re-declared verbatim from migration 010 so a fresh `CREATE OR REPLACE` is
-- guaranteed to pick up the new helper. Behaviour is identical to the
-- original — only the underlying random source has changed.
-- ----------------------------------------------------------------------------

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
