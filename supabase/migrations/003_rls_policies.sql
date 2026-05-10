-- ============================================================================
-- 003_rls_policies.sql
--
-- Az alkalmazás teljes RLS policy halmaza a végső állapotban.
--
-- Tartalom:
--   - is_admin() helper (SECURITY DEFINER, search_path=public, REVOKE PUBLIC).
--   - profiles, articles, products, product_variants, players, matches,
--     match_sectors, tickets, posts, comments, reactions, polls, votes,
--     coupons, redeemed_coupons, cart_items, wishlist, reviews, orders,
--     order_items, user_points, point_transactions, cookie_consents,
--     page_views, standings_cache, scorers_cache, follows, conversations,
--     messages, dream_teams policy-i.
--   - storage.objects post-images bucket: own-prefix INSERT/DELETE.
--
-- Idempotens: minden policy DROP IF EXISTS-szel kezdődik.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_admin()
--
-- STABLE + SECURITY DEFINER + pinned search_path. SECURITY DEFINER kötelező,
-- mert a profiles SELECT policy hivatkozik rá; DEFINER nélkül a profiles RLS
-- végtelen rekurzióba esne. REVOKE FROM PUBLIC + GRANT authenticated +
-- service_role: anon nem hívhatja (lásd coupons SELECT policy szétbontása).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ============================================================================
-- profiles
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- articles  (public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "articles_select_public" ON public.articles;
CREATE POLICY "articles_select_public"
  ON public.articles FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "articles_insert_admin" ON public.articles;
CREATE POLICY "articles_insert_admin"
  ON public.articles FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "articles_update_admin" ON public.articles;
CREATE POLICY "articles_update_admin"
  ON public.articles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "articles_delete_admin" ON public.articles;
CREATE POLICY "articles_delete_admin"
  ON public.articles FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- products  (public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
  ON public.products FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- product_variants  (public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "product_variants_select_public" ON public.product_variants;
CREATE POLICY "product_variants_select_public"
  ON public.product_variants FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "product_variants_insert_admin" ON public.product_variants;
CREATE POLICY "product_variants_insert_admin"
  ON public.product_variants FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_variants_update_admin" ON public.product_variants;
CREATE POLICY "product_variants_update_admin"
  ON public.product_variants FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_variants_delete_admin" ON public.product_variants;
CREATE POLICY "product_variants_delete_admin"
  ON public.product_variants FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- players  (public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "players_select_all" ON public.players;
CREATE POLICY "players_select_all"
  ON public.players FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "players_insert_admin" ON public.players;
CREATE POLICY "players_insert_admin"
  ON public.players FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "players_update_admin" ON public.players;
CREATE POLICY "players_update_admin"
  ON public.players FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "players_delete_admin" ON public.players;
CREATE POLICY "players_delete_admin"
  ON public.players FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- matches  (public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "matches_select_public" ON public.matches;
CREATE POLICY "matches_select_public"
  ON public.matches FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "matches_insert_admin" ON public.matches;
CREATE POLICY "matches_insert_admin"
  ON public.matches FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "matches_update_admin" ON public.matches;
CREATE POLICY "matches_update_admin"
  ON public.matches FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "matches_delete_admin" ON public.matches;
CREATE POLICY "matches_delete_admin"
  ON public.matches FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- match_sectors  (public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "match_sectors_select_public" ON public.match_sectors;
CREATE POLICY "match_sectors_select_public"
  ON public.match_sectors FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "match_sectors_insert_admin" ON public.match_sectors;
CREATE POLICY "match_sectors_insert_admin"
  ON public.match_sectors FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "match_sectors_update_admin" ON public.match_sectors;
CREATE POLICY "match_sectors_update_admin"
  ON public.match_sectors FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "match_sectors_delete_admin" ON public.match_sectors;
CREATE POLICY "match_sectors_delete_admin"
  ON public.match_sectors FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- tickets  (read own/admin; write csak purchase_tickets RPC-n keresztül)
-- ============================================================================

DROP POLICY IF EXISTS "tickets_select_own_or_admin" ON public.tickets;
CREATE POLICY "tickets_select_own_or_admin"
  ON public.tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- posts
--
-- SELECT public; INSERT két permissive policy (admin tetszőleges author_id-vel,
-- user csak saját author_id-vel; PostgreSQL OR-olva kombinálja); UPDATE admin;
-- DELETE saját VAGY admin (két policy).
-- ============================================================================

DROP POLICY IF EXISTS "posts_select_public" ON public.posts;
CREATE POLICY "posts_select_public"
  ON public.posts FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "posts_insert_admin" ON public.posts;
CREATE POLICY "posts_insert_admin"
  ON public.posts FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "posts_insert_own_author" ON public.posts;
CREATE POLICY "posts_insert_own_author"
  ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "posts_update_admin" ON public.posts;
CREATE POLICY "posts_update_admin"
  ON public.posts FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "posts_delete_admin" ON public.posts;
CREATE POLICY "posts_delete_admin"
  ON public.posts FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE TO authenticated USING (author_id = auth.uid());

-- ============================================================================
-- comments
-- ============================================================================

DROP POLICY IF EXISTS "comments_select_public" ON public.comments;
CREATE POLICY "comments_select_public"
  ON public.comments FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own_or_admin" ON public.comments;
CREATE POLICY "comments_delete_own_or_admin"
  ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- reactions
-- ============================================================================

DROP POLICY IF EXISTS "reactions_select_public" ON public.reactions;
CREATE POLICY "reactions_select_public"
  ON public.reactions FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "reactions_insert_own" ON public.reactions;
CREATE POLICY "reactions_insert_own"
  ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_update_own" ON public.reactions;
CREATE POLICY "reactions_update_own"
  ON public.reactions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;
CREATE POLICY "reactions_delete_own"
  ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- polls (public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "polls_select_public" ON public.polls;
CREATE POLICY "polls_select_public"
  ON public.polls FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "polls_insert_admin" ON public.polls;
CREATE POLICY "polls_insert_admin"
  ON public.polls FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "polls_update_admin" ON public.polls;
CREATE POLICY "polls_update_admin"
  ON public.polls FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "polls_delete_admin" ON public.polls;
CREATE POLICY "polls_delete_admin"
  ON public.polls FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- votes
-- ============================================================================

DROP POLICY IF EXISTS "votes_select_own_or_admin" ON public.votes;
CREATE POLICY "votes_select_own_or_admin"
  ON public.votes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "votes_insert_own_active" ON public.votes;
CREATE POLICY "votes_insert_own_active"
  ON public.votes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.polls p
       WHERE p.id = votes.poll_id
         AND p.is_active = TRUE
    )
  );

-- ============================================================================
-- coupons
--
-- Anon és authenticated szétbontva, hogy az anon ág NE hívja az is_admin()-t
-- (különben a függvény anon-callable-nek számítana és a Supabase linter
-- megjelölné). Az authenticated ág admin szuperláthatóságot ad inaktív
-- kuponokra is.
-- ============================================================================

DROP POLICY IF EXISTS "coupons_select_active_public" ON public.coupons;
DROP POLICY IF EXISTS "coupons_select_active_anon" ON public.coupons;
DROP POLICY IF EXISTS "coupons_select_active_or_admin" ON public.coupons;

CREATE POLICY "coupons_select_active_anon"
  ON public.coupons FOR SELECT TO anon
  USING (is_active = TRUE);

CREATE POLICY "coupons_select_active_or_admin"
  ON public.coupons FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "coupons_insert_admin" ON public.coupons;
CREATE POLICY "coupons_insert_admin"
  ON public.coupons FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_update_admin" ON public.coupons;
CREATE POLICY "coupons_update_admin"
  ON public.coupons FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_delete_admin" ON public.coupons;
CREATE POLICY "coupons_delete_admin"
  ON public.coupons FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- redeemed_coupons (read own/admin; write csak SECURITY DEFINER RPC-ken)
-- ============================================================================

DROP POLICY IF EXISTS "redeemed_coupons_select_own_or_admin" ON public.redeemed_coupons;
CREATE POLICY "redeemed_coupons_select_own_or_admin"
  ON public.redeemed_coupons FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- cart_items (own only — admin nem fér hozzá kosárhoz, az privát/rövid életű)
-- ============================================================================

DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
CREATE POLICY "cart_items_select_own"
  ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
CREATE POLICY "cart_items_insert_own"
  ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
CREATE POLICY "cart_items_update_own"
  ON public.cart_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
CREATE POLICY "cart_items_delete_own"
  ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- wishlist (own only)
-- ============================================================================

DROP POLICY IF EXISTS "wishlist_select_own" ON public.wishlist;
CREATE POLICY "wishlist_select_own"
  ON public.wishlist FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wishlist_insert_own" ON public.wishlist;
CREATE POLICY "wishlist_insert_own"
  ON public.wishlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wishlist_delete_own" ON public.wishlist;
CREATE POLICY "wishlist_delete_own"
  ON public.wishlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- reviews
--
-- SELECT: visible OR own OR admin
-- INSERT: own
-- UPDATE: admin only (moderation toggle)
-- DELETE: own OR admin
-- ============================================================================

DROP POLICY IF EXISTS "reviews_select_visible_or_own_or_admin" ON public.reviews;
CREATE POLICY "reviews_select_visible_or_own_or_admin"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (
    is_visible = TRUE
    OR auth.uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_update_admin" ON public.reviews;
CREATE POLICY "reviews_update_admin"
  ON public.reviews FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reviews_delete_own_or_admin" ON public.reviews;
CREATE POLICY "reviews_delete_own_or_admin"
  ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- orders
--
-- SELECT own/admin; UPDATE admin (status transitions); INSERT/DELETE szigorúan
-- service-role / checkout_order RPC-n keresztül.
-- ============================================================================

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
CREATE POLICY "orders_select_own_or_admin"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;
CREATE POLICY "orders_update_admin"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- order_items (read own-order/admin; write csak service-role)
-- ============================================================================

DROP POLICY IF EXISTS "order_items_select_own_order_or_admin" ON public.order_items;
CREATE POLICY "order_items_select_own_order_or_admin"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_items.order_id
         AND o.user_id = auth.uid()
    )
  );

-- ============================================================================
-- user_points (read own/admin; write csak SECURITY DEFINER trigger / RPC)
-- ============================================================================

DROP POLICY IF EXISTS "user_points_select_own_or_admin" ON public.user_points;
CREATE POLICY "user_points_select_own_or_admin"
  ON public.user_points FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- point_transactions (read own/admin; write csak SECURITY DEFINER RPC)
-- ============================================================================

DROP POLICY IF EXISTS "point_transactions_select_own_or_admin" ON public.point_transactions;
CREATE POLICY "point_transactions_select_own_or_admin"
  ON public.point_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- cookie_consents, page_views (admin SELECT only; write csak service-role)
-- ============================================================================

DROP POLICY IF EXISTS "cookie_consents_select_admin" ON public.cookie_consents;
CREATE POLICY "cookie_consents_select_admin"
  ON public.cookie_consents FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "page_views_select_admin" ON public.page_views;
CREATE POLICY "page_views_select_admin"
  ON public.page_views FOR SELECT TO authenticated USING (public.is_admin());

-- ============================================================================
-- standings_cache, scorers_cache (public read; write csak service-role)
-- ============================================================================

DROP POLICY IF EXISTS "standings_cache_select_public" ON public.standings_cache;
CREATE POLICY "standings_cache_select_public"
  ON public.standings_cache FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "scorers_cache_select_public" ON public.scorers_cache;
CREATE POLICY "scorers_cache_select_public"
  ON public.scorers_cache FOR SELECT TO anon, authenticated USING (TRUE);

-- ============================================================================
-- follows  (Iter22 jóváhagyás-alapú)
--
-- SELECT: accepted publikus + pending csak az érintett feleknek.
-- INSERT: csak saját follower_id-vel ÉS pending státusszal.
-- UPDATE: csak following_id (a célszemély) léphet pending -> accepted.
-- DELETE: bárki az érintett felek közül törölheti (visszavonás / kikövetés /
--         elutasítás).
-- ============================================================================

DROP POLICY IF EXISTS "follows_select_public" ON public.follows;
DROP POLICY IF EXISTS "follows_select_accepted_public" ON public.follows;
CREATE POLICY "follows_select_accepted_public"
  ON public.follows FOR SELECT TO anon, authenticated
  USING (status = 'accepted');

DROP POLICY IF EXISTS "follows_select_pending_involved" ON public.follows;
CREATE POLICY "follows_select_pending_involved"
  ON public.follows FOR SELECT TO authenticated
  USING (
    status = 'pending'
    AND (auth.uid() = follower_id OR auth.uid() = following_id)
  );

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id AND status = 'pending');

DROP POLICY IF EXISTS "follows_update_target_accepts" ON public.follows;
CREATE POLICY "follows_update_target_accepts"
  ON public.follows FOR UPDATE TO authenticated
  USING (auth.uid() = following_id AND status = 'pending')
  WITH CHECK (auth.uid() = following_id AND status = 'accepted');

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_involved" ON public.follows;
CREATE POLICY "follows_delete_involved"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- ============================================================================
-- conversations
--
-- SELECT csak résztvevőnek; INSERT csak résztvevő ÉS mutual follow áll fenn;
-- UPDATE csak résztvevő (last_message_at karbantartás).
-- ============================================================================

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);

DROP POLICY IF EXISTS "conversations_insert_participant_with_mutual_follow" ON public.conversations;
CREATE POLICY "conversations_insert_participant_with_mutual_follow"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = participant_a OR auth.uid() = participant_b)
    AND public.is_mutual_follow(participant_a, participant_b)
  );

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b)
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

-- ============================================================================
-- messages
--
-- SELECT csak résztvevő; INSERT csak ha sender_id = auth.uid() ÉS résztvevő;
-- UPDATE csak a fogadó (sender_id <> auth.uid()) — read_at beállítás.
-- ============================================================================

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant_as_sender" ON public.messages;
CREATE POLICY "messages_insert_participant_as_sender"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_update_recipient_marks_read" ON public.messages;
CREATE POLICY "messages_update_recipient_marks_read"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

-- ============================================================================
-- dream_teams (own only — privát adat, nincs megosztás)
-- ============================================================================

DROP POLICY IF EXISTS "dream_teams_select_own" ON public.dream_teams;
CREATE POLICY "dream_teams_select_own"
  ON public.dream_teams FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "dream_teams_insert_own" ON public.dream_teams;
CREATE POLICY "dream_teams_insert_own"
  ON public.dream_teams FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dream_teams_update_own" ON public.dream_teams;
CREATE POLICY "dream_teams_update_own"
  ON public.dream_teams FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dream_teams_delete_own" ON public.dream_teams;
CREATE POLICY "dream_teams_delete_own"
  ON public.dream_teams FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- storage.objects — post-images bucket: own-prefix INSERT/DELETE.
--
-- A többi bucket (profile-, article-, player-, product-images) admin-only
-- írású a service-role kliensen keresztül, ezért nincs külön policy hozzájuk.
-- A post-images-be authenticated user a saját {user_id}/... prefix-szel tölthet.
-- A public read-et a bucket public flag biztosítja (nincs SELECT policy).
-- ============================================================================

DROP POLICY IF EXISTS "post_images_insert_own_prefix" ON storage.objects;
CREATE POLICY "post_images_insert_own_prefix"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "post_images_delete_own_prefix" ON storage.objects;
CREATE POLICY "post_images_delete_own_prefix"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- product_images  (Iter28 — public read, admin write)
-- ============================================================================

DROP POLICY IF EXISTS "product_images_select_public" ON public.product_images;
CREATE POLICY "product_images_select_public"
  ON public.product_images FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "product_images_insert_admin" ON public.product_images;
CREATE POLICY "product_images_insert_admin"
  ON public.product_images FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_images_update_admin" ON public.product_images;
CREATE POLICY "product_images_update_admin"
  ON public.product_images FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_images_delete_admin" ON public.product_images;
CREATE POLICY "product_images_delete_admin"
  ON public.product_images FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- dashboard_preferences  (Iter26 — own read/write, admin read)
-- ============================================================================

DROP POLICY IF EXISTS "dashboard_preferences_select_own_or_admin"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_select_own_or_admin"
  ON public.dashboard_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "dashboard_preferences_insert_own"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_insert_own"
  ON public.dashboard_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dashboard_preferences_update_own"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_update_own"
  ON public.dashboard_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dashboard_preferences_delete_own_or_admin"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_delete_own_or_admin"
  ON public.dashboard_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- season caches  (Iter27 — public SELECT, writes via service-role only)
-- ============================================================================

DROP POLICY IF EXISTS "season_evolution_cache_select_public"
  ON public.season_evolution_cache;
CREATE POLICY "season_evolution_cache_select_public"
  ON public.season_evolution_cache FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "season_form_cache_select_public"
  ON public.season_form_cache;
CREATE POLICY "season_form_cache_select_public"
  ON public.season_form_cache FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "match_details_cache_select_public"
  ON public.match_details_cache;
CREATE POLICY "match_details_cache_select_public"
  ON public.match_details_cache FOR SELECT TO anon, authenticated USING (TRUE);
