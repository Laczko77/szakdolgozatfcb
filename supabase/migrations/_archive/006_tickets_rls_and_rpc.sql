-- ============================================================================
-- 006_tickets_rls_and_rpc.sql
-- RLS policies for the ticketing tables (matches, match_sectors, tickets)
-- plus the purchase_tickets() RPC for transactional ticket purchases.
--
-- Idempotent: every policy and function is dropped/replaced before recreation.
-- ============================================================================

-- ============================================================================
-- matches  — public read, admin write.
-- ============================================================================

DROP POLICY IF EXISTS "matches_select_public" ON public.matches;
CREATE POLICY "matches_select_public"
  ON public.matches
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "matches_insert_admin" ON public.matches;
CREATE POLICY "matches_insert_admin"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "matches_update_admin" ON public.matches;
CREATE POLICY "matches_update_admin"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "matches_delete_admin" ON public.matches;
CREATE POLICY "matches_delete_admin"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- match_sectors  — public read, admin write.
-- ============================================================================

DROP POLICY IF EXISTS "match_sectors_select_public" ON public.match_sectors;
CREATE POLICY "match_sectors_select_public"
  ON public.match_sectors
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "match_sectors_insert_admin" ON public.match_sectors;
CREATE POLICY "match_sectors_insert_admin"
  ON public.match_sectors
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "match_sectors_update_admin" ON public.match_sectors;
CREATE POLICY "match_sectors_update_admin"
  ON public.match_sectors
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "match_sectors_delete_admin" ON public.match_sectors;
CREATE POLICY "match_sectors_delete_admin"
  ON public.match_sectors
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- tickets
--
-- Read: user sees only their own tickets; admins see all.
-- Write: no INSERT/UPDATE/DELETE policy (deny-by-default). Purchases go
-- exclusively through the purchase_tickets() RPC (SECURITY DEFINER below) so
-- the row-level checks (4-ticket cap, capacity, atomic seat allocation) cannot
-- be bypassed by direct INSERTs.
-- ============================================================================

DROP POLICY IF EXISTS "tickets_select_own_or_admin" ON public.tickets;
CREATE POLICY "tickets_select_own_or_admin"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- purchase_tickets()  — transactional ticket purchase RPC.
--
-- Why an RPC and not application-level SQL:
--   * Two concurrent purchasers must never receive the same seat number.
--   * sold_seats must never exceed total_seats.
--   * The 4-ticket-per-user-per-match cap must be evaluated atomically with
--     the insert.
-- All three are achieved by acquiring an advisory transaction lock keyed on
-- the sector id, then doing capacity + cap checks, INSERTing the rows, and
-- updating sold_seats — all in a single transaction.
--
-- Returns: the inserted ticket rows as JSONB array, so callers can render
-- the seat assignment immediately without a follow-up query.
--
-- Errors are raised with explicit SQLSTATE codes so the API layer can map
-- them to HTTP status codes:
--   P0001 — generic business-rule violation (caller passes message through)
-- ============================================================================

DROP FUNCTION IF EXISTS public.purchase_tickets(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.purchase_tickets(
  p_user_id    UUID,
  p_sector_id  UUID,
  p_quantity   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sector       public.match_sectors%ROWTYPE;
  v_existing_cnt INTEGER;
  v_next_seat    INTEGER;
  v_inserted     JSONB := '[]'::jsonb;
  v_seat_no      INTEGER;
  v_ticket_id    UUID;
  v_purchased_at TIMESTAMPTZ;
  i              INTEGER;
BEGIN
  -- Input validation -------------------------------------------------------
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 4 THEN
    RAISE EXCEPTION 'A jegyek darabszáma 1 és 4 között kell legyen'
      USING ERRCODE = 'P0001';
  END IF;

  -- Serialize on the sector so concurrent purchases can't oversell.
  -- hashtextextended -> bigint, suitable for pg_advisory_xact_lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_sector_id::text, 0));

  -- Lock the sector row as well; if it gets deleted mid-transaction we abort.
  SELECT *
    INTO v_sector
    FROM public.match_sectors
   WHERE id = p_sector_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott szektor nem található'
      USING ERRCODE = 'P0001';
  END IF;

  -- Capacity check ---------------------------------------------------------
  IF v_sector.sold_seats + p_quantity > v_sector.total_seats THEN
    RAISE EXCEPTION 'Nincs elég szabad hely a szektorban (szabad: %)',
                    v_sector.total_seats - v_sector.sold_seats
      USING ERRCODE = 'P0001';
  END IF;

  -- 4-ticket-per-user-per-match cap ---------------------------------------
  SELECT COUNT(*)
    INTO v_existing_cnt
    FROM public.tickets t
    JOIN public.match_sectors s ON s.id = t.sector_id
   WHERE t.user_id = p_user_id
     AND s.match_id = v_sector.match_id;

  IF v_existing_cnt + p_quantity > 4 THEN
    RAISE EXCEPTION 'Egy felhasználó legfeljebb 4 jegyet vásárolhat egy meccsre (már megvásárolva: %)',
                    v_existing_cnt
      USING ERRCODE = 'P0001';
  END IF;

  -- Allocate seat numbers (next contiguous block after the highest seat) ---
  -- Using max(seat_number) is safe under our advisory lock + row-level lock;
  -- gaps from cancellations (not in scope) would be ignored on purpose.
  SELECT COALESCE(MAX(seat_number), 0) + 1
    INTO v_next_seat
    FROM public.tickets
   WHERE sector_id = p_sector_id;

  v_purchased_at := NOW();

  -- Insert tickets one-by-one so we can collect the generated IDs.
  FOR i IN 0 .. p_quantity - 1 LOOP
    v_seat_no := v_next_seat + i;

    INSERT INTO public.tickets (user_id, sector_id, seat_number, purchased_at)
    VALUES (p_user_id, p_sector_id, v_seat_no, v_purchased_at)
    RETURNING id INTO v_ticket_id;

    v_inserted := v_inserted || jsonb_build_object(
      'id',           v_ticket_id,
      'user_id',      p_user_id,
      'sector_id',    p_sector_id,
      'seat_number',  v_seat_no,
      'purchased_at', v_purchased_at
    );
  END LOOP;

  -- Bump sold_seats counter ------------------------------------------------
  UPDATE public.match_sectors
     SET sold_seats = sold_seats + p_quantity
   WHERE id = p_sector_id;

  RETURN v_inserted;
END;
$$;

-- The RPC must be callable by authenticated users; the API route enforces
-- auth, then forwards user_id from the verified session.
REVOKE ALL ON FUNCTION public.purchase_tickets(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_tickets(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_tickets(UUID, UUID, INTEGER) TO service_role;
