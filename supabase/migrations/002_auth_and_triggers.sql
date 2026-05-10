-- ============================================================================
-- 002_auth_and_triggers.sql
--
-- Auth-szintű triggerek a public.profiles és public.user_points sorok
-- automatikus létrehozására új auth.users felvétel után (email/jelszó signup
-- ÉS Google OAuth egyaránt).
--
-- handle_new_user():
--   - SECURITY DEFINER: bypass-olja a profiles RLS-t (nincs INSERT policy ott).
--   - search_path = public (search_path hijacking ellen).
--   - REVOKE FROM PUBLIC: trigger-only függvény, direkt RPC hívás nem kell.
--
-- Idempotens: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- profiles: username = raw_user_meta_data.username VAGY email lokális rész
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  -- user_points: zero balance, zero lifetime
  INSERT INTO public.user_points (user_id, balance, total_earned)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- product_images triggers (Iter28)
--
-- A: enforce at most one cover per product (BEFORE INSERT/UPDATE).
-- B: promote a new cover when the current cover is removed (AFTER UPDATE/DELETE).
-- C: keep products.image_url in sync with the current cover (AFTER INSERT/UPDATE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.product_images_enforce_single_cover()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_cover = TRUE THEN
    UPDATE public.product_images
       SET is_cover = FALSE
     WHERE product_id = NEW.product_id
       AND id <> NEW.id
       AND is_cover = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_images_enforce_single_cover_tg
  ON public.product_images;
CREATE TRIGGER product_images_enforce_single_cover_tg
  BEFORE INSERT OR UPDATE OF is_cover ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.product_images_enforce_single_cover();

CREATE OR REPLACE FUNCTION public.product_images_promote_cover()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_has_cover  BOOLEAN;
  v_promote_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_product_id := OLD.product_id;
    IF OLD.is_cover = FALSE THEN
      RETURN OLD;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_product_id := NEW.product_id;
    IF NOT (OLD.is_cover = TRUE AND NEW.is_cover = FALSE) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_images
     WHERE product_id = v_product_id AND is_cover = TRUE
  ) INTO v_has_cover;

  IF v_has_cover THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id
    INTO v_promote_id
    FROM public.product_images
   WHERE product_id = v_product_id
   ORDER BY display_order ASC, created_at ASC, id ASC
   LIMIT 1;

  IF v_promote_id IS NOT NULL THEN
    UPDATE public.product_images
       SET is_cover = TRUE
     WHERE id = v_promote_id;
  ELSE
    UPDATE public.products
       SET image_url = NULL
     WHERE id = v_product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS product_images_promote_cover_tg
  ON public.product_images;
CREATE TRIGGER product_images_promote_cover_tg
  AFTER UPDATE OR DELETE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.product_images_promote_cover();

CREATE OR REPLACE FUNCTION public.product_images_sync_legacy_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.is_cover = TRUE THEN
      UPDATE public.products
         SET image_url = NEW.image_url
       WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.is_cover = TRUE
       AND (OLD.is_cover = FALSE OR OLD.image_url IS DISTINCT FROM NEW.image_url) THEN
      UPDATE public.products
         SET image_url = NEW.image_url
       WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_images_sync_legacy_url_tg
  ON public.product_images;
CREATE TRIGGER product_images_sync_legacy_url_tg
  AFTER INSERT OR UPDATE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.product_images_sync_legacy_url();
