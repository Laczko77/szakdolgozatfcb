-- ============================================================================
-- 004_rpc_and_views.sql
--
-- SECURITY DEFINER RPC-k és aggregate view-k a végső állapotban.
--
-- Tartalom:
--   - is_mutual_follow                — RLS helper (status='accepted' szűrés)
--   - _generate_coupon_code           — gen_random_uuid alapú generátor
--   - redeem_coupon                   — pontbolt beváltás
--   - apply_coupon_to_order           — webshop kupon érvényesítés
--   - consume_coupon                  — generikus kupon felhasználás (jegyvétel)
--   - purchase_tickets                — atomic jegyvásárlás
--   - resolve_poll                    — szavazás lezárás + nyertes pontok
--   - checkout_order                  — atomic checkout (stock + order + cart)
--   - audit_rls_coverage              — admin verifikáció (RLS coverage)
--   - Aggregate views (security_invoker = on):
--       coupon_redeem_stats, poll_results, page_view_counts_by_path,
--       product_view_counts, recommended_products
--
-- Privilege minta (Iter23 hardening):
--   - Minden SECURITY DEFINER RPC: REVOKE FROM PUBLIC, anon, authenticated
--     + GRANT TO service_role.
--   - is_mutual_follow KIVÉTEL: RLS USING-ban hivatkozott, ezért GRANT
--     authenticated + service_role.
--   - is_admin (003_rls_policies.sql) is hasonló: anon-tól REVOKE-olva,
--     GRANT authenticated + service_role.
-- ============================================================================

-- ============================================================================
-- is_mutual_follow(p_a, p_b)
--
-- Két irányú accepted follow ellenőrzés. Az Iter22 status mező bevezetésével
-- csak az 'accepted' sorok számítanak. A conversations INSERT WITH CHECK
-- policy hivatkozik rá.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_mutual_follow(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
     WHERE follower_id = p_a
       AND following_id = p_b
       AND status = 'accepted'
  )
  AND EXISTS (
    SELECT 1 FROM public.follows
     WHERE follower_id = p_b
       AND following_id = p_a
       AND status = 'accepted'
  );
$$;

REVOKE ALL ON FUNCTION public.is_mutual_follow(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mutual_follow(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- _generate_coupon_code()
--
-- BARCA-XXXX-XXXX formátumú kuponkód generálása. gen_random_uuid alapú (a
-- pgcrypto gen_random_bytes nem mindig elérhető Supabase-en). Két független
-- UUID-ből 4-4 hex karakter — ~16^8 kombináció / szegmens. UNIQUE(code) +
-- 10x retry a redeem_coupon-ban backstop-olja az ütközéseket.
-- ============================================================================

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

REVOKE EXECUTE ON FUNCTION public._generate_coupon_code() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- redeem_coupon(p_user_id, p_coupon_id)
--
-- Pontbolt beváltási flow. Atomic:
--   1. user_points sor lock (SELECT FOR UPDATE).
--   2. Kupon validáció (létezik, aktív, balance >= point_cost).
--   3. balance dekrementálás.
--   4. Egyedi BARCA-XXXX-XXXX kód generálás (10x retry).
--   5. redeemed_coupons sor INSERT.
--   6. point_transactions ledger entry (negatív amount, reason='coupon_redeem').
-- ============================================================================

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
  -- Defensive: ensure user_points row exists.
  INSERT INTO public.user_points (user_id, balance, total_earned)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance
    INTO v_balance
    FROM public.user_points
   WHERE user_id = p_user_id
   FOR UPDATE;

  SELECT *
    INTO v_coupon
    FROM public.coupons
   WHERE id = p_coupon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott kupon nem található' USING ERRCODE = 'P0001';
  END IF;

  IF v_coupon.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'A kupon nem érhető el' USING ERRCODE = 'P0001';
  END IF;

  IF v_balance < v_coupon.point_cost THEN
    RAISE EXCEPTION 'Nincs elég pontod a beváltáshoz (egyenleg: %, ár: %)',
      v_balance, v_coupon.point_cost
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.user_points
     SET balance = balance - v_coupon.point_cost
   WHERE user_id = p_user_id;

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
    END;
  END LOOP;

  INSERT INTO public.point_transactions (user_id, amount, reason, poll_id)
  VALUES (p_user_id, -v_coupon.point_cost, 'coupon_redeem', NULL);

  SELECT *
    INTO v_redeemed
    FROM public.redeemed_coupons
   WHERE id = v_redeemed_id;

  RETURN to_jsonb(v_redeemed);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_coupon(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(uuid, uuid) TO service_role;

-- ============================================================================
-- apply_coupon_to_order(p_order_id, p_user_id, p_code)
--
-- Webshop checkout: kupon kódot order-hez rendel + is_used=true.
-- ============================================================================

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
  v_redeemed   public.redeemed_coupons%ROWTYPE;
  v_coupon     public.coupons%ROWTYPE;
  v_order_user UUID;
BEGIN
  SELECT user_id INTO v_order_user
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A rendelés nem található' USING ERRCODE = 'P0001';
  END IF;
  IF v_order_user IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'A rendelés nem ehhez a felhasználóhoz tartozik'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
    INTO v_redeemed
    FROM public.redeemed_coupons
   WHERE code = p_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott kuponkód érvénytelen' USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.user_id <> p_user_id THEN
    RAISE EXCEPTION 'A kuponkód nem ehhez a felhasználóhoz tartozik'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.is_used THEN
    RAISE EXCEPTION 'A kuponkód már fel lett használva' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
    INTO v_coupon
    FROM public.coupons
   WHERE id = v_redeemed.coupon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A kuponhoz tartozó leírás nem található'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.redeemed_coupons SET is_used = TRUE WHERE id = v_redeemed.id;
  UPDATE public.orders SET coupon_id = v_redeemed.id WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'redeemed_id',    v_redeemed.id,
    'coupon_id',      v_coupon.id,
    'discount_type',  v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_coupon_to_order(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_coupon_to_order(uuid, uuid, text) TO service_role;

-- ============================================================================
-- consume_coupon(p_user_id, p_code)
--
-- Generikus single-shot kupon felhasználás (jegyvásárlási flow).
-- ============================================================================

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
    RAISE EXCEPTION 'A megadott kuponkód érvénytelen' USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.user_id <> p_user_id THEN
    RAISE EXCEPTION 'A kuponkód nem ehhez a felhasználóhoz tartozik'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_redeemed.is_used THEN
    RAISE EXCEPTION 'A kuponkód már fel lett használva' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
    INTO v_coupon
    FROM public.coupons
   WHERE id = v_redeemed.coupon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A kuponhoz tartozó leírás nem található'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.redeemed_coupons SET is_used = TRUE WHERE id = v_redeemed.id;

  RETURN jsonb_build_object(
    'redeemed_id',    v_redeemed.id,
    'coupon_id',      v_coupon.id,
    'discount_type',  v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_coupon(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_coupon(uuid, text) TO service_role;

-- ============================================================================
-- purchase_tickets(p_user_id, p_sector_id, p_quantity)
--
-- Atomic jegyvásárlás: advisory xact lock + sector row lock + 4-jegy/user/meccs
-- limit + összegszámítás + ticket beszúrás + sold_seats inkrement.
-- ============================================================================

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
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 4 THEN
    RAISE EXCEPTION 'A jegyek darabszáma 1 és 4 között kell legyen'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_sector_id::text, 0));

  SELECT *
    INTO v_sector
    FROM public.match_sectors
   WHERE id = p_sector_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott szektor nem található' USING ERRCODE = 'P0001';
  END IF;

  IF v_sector.sold_seats + p_quantity > v_sector.total_seats THEN
    RAISE EXCEPTION 'Nincs elég szabad hely a szektorban (szabad: %)',
                    v_sector.total_seats - v_sector.sold_seats
      USING ERRCODE = 'P0001';
  END IF;

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

  SELECT COALESCE(MAX(seat_number), 0) + 1
    INTO v_next_seat
    FROM public.tickets
   WHERE sector_id = p_sector_id;

  v_purchased_at := NOW();

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

  UPDATE public.match_sectors
     SET sold_seats = sold_seats + p_quantity
   WHERE id = p_sector_id;

  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_tickets(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_tickets(uuid, uuid, integer) TO service_role;

-- ============================================================================
-- resolve_poll(p_poll_id, p_correct_option)
--
-- Szavazás lezárás + nyertesek pontozása (50 pont / fő).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_poll(
  p_poll_id        UUID,
  p_correct_option INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll              public.polls%ROWTYPE;
  v_option_count      INTEGER;
  v_winner_reward     CONSTANT INTEGER := 50;
  v_total_correct     INTEGER := 0;
  v_winners_credited  INTEGER := 0;
  v_already_credited  INTEGER := 0;
  v_voter             RECORD;
  v_already_paid      BOOLEAN;
BEGIN
  SELECT *
    INTO v_poll
    FROM public.polls
   WHERE id = p_poll_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott szavazás nem található' USING ERRCODE = 'P0001';
  END IF;

  v_option_count := jsonb_array_length(v_poll.options);

  IF p_correct_option IS NULL
     OR p_correct_option < 0
     OR p_correct_option >= v_option_count THEN
    RAISE EXCEPTION 'Érvénytelen helyes válasz index (opciók száma: %)', v_option_count
      USING ERRCODE = 'P0001';
  END IF;

  IF v_poll.correct_option IS NOT NULL THEN
    IF v_poll.correct_option <> p_correct_option THEN
      RAISE EXCEPTION 'A szavazás már le van zárva eltérő helyes válasszal'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.polls
     SET correct_option = p_correct_option,
         is_active      = FALSE
   WHERE id = p_poll_id;

  FOR v_voter IN
    SELECT user_id
      FROM public.votes
     WHERE poll_id = p_poll_id
       AND selected_option = p_correct_option
  LOOP
    v_total_correct := v_total_correct + 1;

    SELECT EXISTS (
      SELECT 1
        FROM public.point_transactions pt
       WHERE pt.user_id = v_voter.user_id
         AND pt.poll_id = p_poll_id
    ) INTO v_already_paid;

    IF v_already_paid THEN
      v_already_credited := v_already_credited + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.user_points (user_id, balance, total_earned)
    VALUES (v_voter.user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_points
       SET balance      = balance + v_winner_reward,
           total_earned = total_earned + v_winner_reward
     WHERE user_id = v_voter.user_id;

    INSERT INTO public.point_transactions (user_id, amount, reason, poll_id)
    VALUES (v_voter.user_id, v_winner_reward, 'poll_win', p_poll_id);

    v_winners_credited := v_winners_credited + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'winners_credited',  v_winners_credited,
    'already_credited',  v_already_credited,
    'total_correct',     v_total_correct,
    'reward_per_winner', v_winner_reward
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_poll(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_poll(uuid, integer) TO service_role;

-- ============================================================================
-- checkout_order(p_user_id, p_total_price, p_shipping_address)
--
-- Atomic webshop checkout. Stable sorrendben lockolja a variánsokat,
-- ellenőrzi a stockot, létrehozza az ordert + order_items-eket, dekrementálja
-- a stockot, és üríti a kosarat — egyetlen tranzakcióban.
-- ============================================================================

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
           pv.stock    AS stock,
           pr.price    AS unit_price,
           pr.id       AS product_id
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
GRANT EXECUTE ON FUNCTION public.checkout_order(uuid, numeric, jsonb) TO service_role;

-- ============================================================================
-- audit_rls_coverage()
--
-- Admin verifikációs helper: visszaadja azokat a public schema táblákat,
-- amelyeken RLS engedélyezett, de NINCS hozzájuk policy. Az üres eredmény
-- a kívánt prod-állapot.
-- ============================================================================

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

REVOKE EXECUTE ON FUNCTION public.audit_rls_coverage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_rls_coverage() TO service_role;

-- ============================================================================
-- Aggregate views (security_invoker = on)
--
-- security_invoker biztosítja, hogy a view a hívó user RLS-e alatt fusson,
-- nem a view-tulajdonos jogosultságaival. A linter (security_definer_view)
-- ennek hiányát ERROR-ként jelölte volna meg.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- coupon_redeem_stats — admin dashboard view: kupononként redeem/used szám.
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

-- ----------------------------------------------------------------------------
-- poll_results — publikus aggregát: szavazatszám opciónként.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- page_view_counts_by_path — admin analytics: page_path szerinti aggregát.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- product_view_counts — admin analytics: termékenkénti view aggregát + meta.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- recommended_products — publikus ajánlás: view_count * (avg_rating/5) score.
-- Iter25: sale fields + effective_price + is_on_sale added.
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

-- ============================================================================
-- get_product_view_counts()  (Iter24)
--
-- SECURITY DEFINER aggregate so anon callers can read per-product view counts
-- without accessing the admin-only page_views table directly.
-- ============================================================================

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

-- ============================================================================
-- set_product_cover_image(p_product_id, p_image_id)  (Iter28)
--
-- Atomic "make this image the cover". The BEFORE trigger handles concurrent
-- cover swaps; this RPC is a convenience wrapper with ownership validation.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_product_cover_image(
  p_product_id UUID,
  p_image_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1
    FROM public.product_images
   WHERE id = p_image_id AND product_id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott kép nem tartozik a termékhez'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.product_images
     SET is_cover = TRUE
   WHERE id = p_image_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_product_cover_image(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_product_cover_image(uuid, uuid) TO service_role;
