-- ============================================================================
-- 002_schema.sql
-- Full database schema for the FC Barcelona Fan Portal.
-- 24 tables. Idempotent: every CREATE uses IF NOT EXISTS.
-- RLS is enabled on every table; per-feature policies live in later migrations.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. profiles  (1:1 with auth.users)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. articles
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. players
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4. products
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 5. product_variants
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size       TEXT,
  color      TEXT,
  stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants(product_id);

-- ----------------------------------------------------------------------------
-- 6. cart_items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, variant_id)
);
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items(user_id);

-- ----------------------------------------------------------------------------
-- 7. orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_price      NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  status           TEXT NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing','shipped','delivered','cancelled')),
  shipping_address JSONB,
  coupon_id        UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx       ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx     ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. order_items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_variant_idx ON public.order_items(variant_id);

-- ----------------------------------------------------------------------------
-- 9. reviews
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 10. wishlist
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS wishlist_user_idx    ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS wishlist_product_idx ON public.wishlist(product_id);

-- ----------------------------------------------------------------------------
-- 11. matches
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_football_id INTEGER UNIQUE,
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  date            TIMESTAMPTZ NOT NULL,
  venue           TEXT,
  status          TEXT
);
CREATE INDEX IF NOT EXISTS matches_date_idx   ON public.matches(date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON public.matches(status);

-- ----------------------------------------------------------------------------
-- 12. match_sectors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_sectors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sector_name TEXT NOT NULL,
  total_seats INTEGER NOT NULL CHECK (total_seats >= 0),
  sold_seats  INTEGER NOT NULL DEFAULT 0 CHECK (sold_seats >= 0),
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  CHECK (sold_seats <= total_seats)
);
CREATE INDEX IF NOT EXISTS match_sectors_match_idx ON public.match_sectors(match_id);

-- ----------------------------------------------------------------------------
-- 13. tickets
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 14. posts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS posts_author_idx     ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts(created_at DESC);

-- ----------------------------------------------------------------------------
-- 15. comments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS comments_user_idx ON public.comments(user_id);

-- ----------------------------------------------------------------------------
-- 16. reactions  (polymorphic against posts and comments)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 17. polls
-- ----------------------------------------------------------------------------
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
-- 18. votes
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 19. user_points
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_points (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance      INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 20. point_transactions
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 21. coupons
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 22. redeemed_coupons
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.redeemed_coupons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coupon_id   UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  code        TEXT NOT NULL UNIQUE,
  is_used     BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS redeemed_coupons_user_idx    ON public.redeemed_coupons(user_id);
CREATE INDEX IF NOT EXISTS redeemed_coupons_coupon_idx  ON public.redeemed_coupons(coupon_id);
CREATE INDEX IF NOT EXISTS redeemed_coupons_is_used_idx ON public.redeemed_coupons(is_used);

-- Late-bound FK from orders.coupon_id (declared above without REFERENCES so
-- this file can be re-run in any order).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_coupon_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_coupon_id_fkey
      FOREIGN KEY (coupon_id) REFERENCES public.redeemed_coupons(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 23. page_views  (analytics; user_id may be null for anonymous visitors)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 24. cookie_consents  (GDPR)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookie_id  TEXT NOT NULL UNIQUE,
  consented  BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-bump articles.updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_set_updated_at ON public.articles;
CREATE TRIGGER articles_set_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS players_set_updated_at ON public.players;
CREATE TRIGGER players_set_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Enable RLS on every table. Per-feature policies are added in later migrations.
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
    'coupons','redeemed_coupons','page_views','cookie_consents'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
