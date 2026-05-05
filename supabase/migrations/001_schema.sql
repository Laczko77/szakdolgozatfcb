-- ============================================================================
-- 001_schema.sql
--
-- FC Barcelona Szurkolói Portál — Konszolidált schema migráció.
--
-- Tartalom (végső állapot, az összes fejlesztési iteráció eredménye):
--   - Extensions
--   - Storage buckets (5 publikus bucket; storage.objects SELECT policy NEM
--     szükséges, mert a buckets.public flag elég a public CDN URL-ekhez)
--   - Összes public.* tábla (CREATE TABLE IF NOT EXISTS, végső oszlopokkal)
--   - Indexek (FK indexekkel együtt)
--   - Generic trigger function: set_updated_at (SECURITY INVOKER, search_path='')
--   - Polls JSONB validation helper: polls_none_option_valid (search_path='')
--   - updated_at triggerek (articles, players, dream_teams)
--   - ENABLE RLS minden táblán
--   - Realtime publication (messages, conversations)
--
-- Idempotens: minden CREATE IF NOT EXISTS / DROP IF EXISTS / OR REPLACE.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Storage buckets
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profile-images', 'profile-images', true),
  ('article-images', 'article-images', true),
  ('player-images',  'player-images',  true),
  ('product-images', 'product-images', true),
  ('post-images',    'post-images',    true)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public;

-- ============================================================================
-- Helper: set_updated_at (used by articles, players, dream_teams triggers)
-- search_path is pinned empty (NEW is sema-resolved by trigger context).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- ============================================================================
-- 1. profiles  (1:1 with auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  username    TEXT UNIQUE,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS profiles_role_idx     ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- ============================================================================
-- 2. articles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.articles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  category   TEXT,
  image_url  TEXT,
  author_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS articles_category_idx   ON public.articles(category);
CREATE INDEX IF NOT EXISTS articles_author_idx     ON public.articles(author_id);
CREATE INDEX IF NOT EXISTS articles_created_at_idx ON public.articles(created_at DESC);

DROP TRIGGER IF EXISTS articles_set_updated_at ON public.articles;
CREATE TRIGGER articles_set_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. players
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.players (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_football_id  INTEGER UNIQUE,
  name             TEXT NOT NULL,
  position         TEXT,
  number           INTEGER,
  image_url        TEXT,
  bio              TEXT,
  stats            JSONB DEFAULT '{}'::jsonb,
  season           INTEGER,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS players_position_idx ON public.players(position);
CREATE INDEX IF NOT EXISTS players_number_idx   ON public.players(number);
CREATE INDEX IF NOT EXISTS players_season_idx   ON public.players(season);

DROP TRIGGER IF EXISTS players_set_updated_at ON public.players;
CREATE TRIGGER players_set_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. products
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url   TEXT,
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_category_idx   ON public.products(category);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON public.products(created_at DESC);

-- ============================================================================
-- 5. product_variants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size       TEXT,
  color      TEXT,
  stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants(product_id);

-- ============================================================================
-- 6. cart_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, variant_id)
);
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items(user_id);

-- ============================================================================
-- 7. coupons (létrehozás előbbre hozva, mert redeemed_coupons hivatkozik rá)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed','free_shipping')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
  point_cost     INTEGER NOT NULL CHECK (point_cost >= 0),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS coupons_is_active_idx ON public.coupons(is_active);

-- ============================================================================
-- 8. redeemed_coupons
-- coupon_id FK: ON DELETE CASCADE (iter23 hard-delete admin endpoint támogatás)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.redeemed_coupons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coupon_id   UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  is_used     BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS redeemed_coupons_user_idx    ON public.redeemed_coupons(user_id);
CREATE INDEX IF NOT EXISTS redeemed_coupons_coupon_idx  ON public.redeemed_coupons(coupon_id);
CREATE INDEX IF NOT EXISTS redeemed_coupons_is_used_idx ON public.redeemed_coupons(is_used);

-- ============================================================================
-- 9. orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_price      NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  status           TEXT NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing','shipped','delivered','cancelled')),
  shipping_address JSONB,
  coupon_id        UUID REFERENCES public.redeemed_coupons(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx       ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx     ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_coupon_idx     ON public.orders(coupon_id);

-- ============================================================================
-- 10. order_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_variant_idx ON public.order_items(variant_id);

-- ============================================================================
-- 11. reviews
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS reviews_user_idx    ON public.reviews(user_id);

-- ============================================================================
-- 12. wishlist
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wishlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS wishlist_user_idx    ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS wishlist_product_idx ON public.wishlist(product_id);

-- ============================================================================
-- 13. matches
--
-- Iter13: home_team_crest, away_team_crest, score, competition oszlopok
-- (football-data.org integráció — denormalizált, hogy a public listing
-- egyetlen SELECT *-ból renderelhető legyen).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_football_id INTEGER UNIQUE,
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  date            TIMESTAMPTZ NOT NULL,
  venue           TEXT,
  status          TEXT,
  home_team_crest TEXT,
  away_team_crest TEXT,
  score           TEXT,
  competition     TEXT
);
CREATE INDEX IF NOT EXISTS matches_date_idx   ON public.matches(date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON public.matches(status);

-- ============================================================================
-- 14. match_sectors
--
-- Iter16: fixed sector domain (TRIBUNA, LATERAL, GOL NORD, GOL SUD)
-- + UNIQUE(match_id, sector_name) az auto-seed idempotenciához.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.match_sectors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sector_name TEXT NOT NULL CHECK (sector_name IN ('TRIBUNA', 'LATERAL', 'GOL NORD', 'GOL SUD')),
  total_seats INTEGER NOT NULL CHECK (total_seats >= 0),
  sold_seats  INTEGER NOT NULL DEFAULT 0 CHECK (sold_seats >= 0),
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  CHECK (sold_seats <= total_seats),
  UNIQUE (match_id, sector_name)
);
CREATE INDEX IF NOT EXISTS match_sectors_match_idx ON public.match_sectors(match_id);

-- ============================================================================
-- 15. tickets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sector_id    UUID NOT NULL REFERENCES public.match_sectors(id) ON DELETE RESTRICT,
  seat_number  INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sector_id, seat_number)
);
CREATE INDEX IF NOT EXISTS tickets_user_idx   ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_sector_idx ON public.tickets(sector_id);

-- ============================================================================
-- 16. posts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS posts_author_idx     ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts(created_at DESC);

-- ============================================================================
-- 17. comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS comments_user_idx ON public.comments(user_id);

-- ============================================================================
-- 18. reactions  (polymorphic against posts and comments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id   UUID NOT NULL,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS reactions_target_idx ON public.reactions(target_type, target_id);

-- ============================================================================
-- 19. polls
--
-- Iter17: polls_options_none_option_shape CHECK constraint (lásd lentebb a
-- helper függvényt). Az is_none: true elem opcionális, és ha van, az utolsó.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.polls (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question       TEXT NOT NULL,
  options        JSONB NOT NULL,
  correct_option INTEGER,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  match_id       UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS polls_match_idx     ON public.polls(match_id);
CREATE INDEX IF NOT EXISTS polls_is_active_idx ON public.polls(is_active);

-- ----------------------------------------------------------------------------
-- polls_none_option_valid: helper a CHECK constraint-hez (subquery tilos
-- direktben CHECK-ben, így IMMUTABLE függvényen keresztül).
-- search_path = '' — a body csak a JSONB argumenton és pg_catalog függvényeken
-- (jsonb_typeof / jsonb_array_elements / count) dolgozik.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.polls_none_option_valid(options JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  none_count INTEGER;
BEGIN
  IF jsonb_typeof(options) IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO none_count
  FROM jsonb_array_elements(options) AS elem
  WHERE (elem ->> 'is_none')::boolean IS TRUE;

  IF none_count = 0 THEN
    RETURN TRUE;
  END IF;
  IF none_count > 1 THEN
    RETURN FALSE;
  END IF;

  RETURN (options -> (jsonb_array_length(options) - 1) ->> 'is_none')::boolean IS TRUE;
END;
$$;

ALTER FUNCTION public.polls_none_option_valid(jsonb) SET search_path = '';

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_options_none_option_shape;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_options_none_option_shape
  CHECK (public.polls_none_option_valid(options));

COMMENT ON CONSTRAINT polls_options_none_option_shape ON public.polls IS
  'Iter17: at most one option may have is_none=true, and if present it must be the last array element.';

-- ============================================================================
-- 20. votes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id         UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  selected_option INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS votes_poll_idx ON public.votes(poll_id);
CREATE INDEX IF NOT EXISTS votes_user_idx ON public.votes(user_id);

-- ============================================================================
-- 21. user_points
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_points (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance      INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- 22. point_transactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.point_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  poll_id    UUID REFERENCES public.polls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS point_transactions_user_idx       ON public.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS point_transactions_created_at_idx ON public.point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS point_transactions_poll_idx       ON public.point_transactions(poll_id);

-- ============================================================================
-- 23. page_views
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.page_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  page_path  TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  cookie_id  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS page_views_user_idx       ON public.page_views(user_id);
CREATE INDEX IF NOT EXISTS page_views_product_idx    ON public.page_views(product_id);
CREATE INDEX IF NOT EXISTS page_views_cookie_idx     ON public.page_views(cookie_id);
CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON public.page_views(created_at DESC);

-- ============================================================================
-- 24. cookie_consents
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookie_id  TEXT NOT NULL UNIQUE,
  consented  BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 25. standings_cache (Iter15)
-- 26. scorers_cache   (Iter15)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.standings_cache (
  id              SERIAL PRIMARY KEY,
  competition_id  INTEGER     NOT NULL,
  season          INTEGER     NOT NULL,
  data            JSONB       NOT NULL,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, season)
);

CREATE TABLE IF NOT EXISTS public.scorers_cache (
  id              SERIAL PRIMARY KEY,
  competition_id  INTEGER     NOT NULL,
  season          INTEGER     NOT NULL,
  data            JSONB       NOT NULL,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, season)
);

-- ============================================================================
-- 27. follows  (Iter18 + Iter22 status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.follows (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT follows_unique_pair UNIQUE (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_follower_idx  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS follows_status_idx    ON public.follows(status);

-- ============================================================================
-- 28. conversations  (Iter18 — DM canonical participant order)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_a   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_b   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT conversations_canonical_order CHECK (participant_a < participant_b),
  CONSTRAINT conversations_unique_pair     UNIQUE (participant_a, participant_b)
);
CREATE INDEX IF NOT EXISTS conversations_participant_a_idx ON public.conversations(participant_a);
CREATE INDEX IF NOT EXISTS conversations_participant_b_idx ON public.conversations(participant_b);
CREATE INDEX IF NOT EXISTS conversations_last_message_idx  ON public.conversations(last_message_at DESC NULLS LAST);

-- ============================================================================
-- 29. messages  (Iter18)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages(sender_id);

-- ============================================================================
-- 30. dream_teams  (Iter19)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dream_teams (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Álomcsapatom'
              CHECK (char_length(name) BETWEEN 1 AND 100),
  formation   TEXT NOT NULL
              CHECK (formation IN ('4-3-3', '4-2-3-1', '3-5-2', '4-4-2')),
  players     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dream_teams_user_id_idx ON public.dream_teams(user_id);

DROP TRIGGER IF EXISTS dream_teams_set_updated_at ON public.dream_teams;
CREATE TRIGGER dream_teams_set_updated_at
  BEFORE UPDATE ON public.dream_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Enable RLS on every table.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','articles','players','products','product_variants',
    'cart_items','orders','order_items','reviews','wishlist',
    'matches','match_sectors','tickets','posts','comments',
    'reactions','polls','votes','user_points','point_transactions',
    'coupons','redeemed_coupons','page_views','cookie_consents',
    'standings_cache','scorers_cache',
    'follows','conversations','messages','dream_teams'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================================
-- Realtime publication (Iter18: DM live updates)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'messages'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'conversations'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
    END IF;
  END IF;
END $$;
