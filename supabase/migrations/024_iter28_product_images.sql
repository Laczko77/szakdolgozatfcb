-- ============================================================================
-- Iteration 28 — Multi-image product gallery.
-- ============================================================================
--
-- Goal: every product can have multiple images. One image per product is the
-- "cover" — surfaced via the legacy `products.image_url` column for backward
-- compatibility. Other images form an ordered gallery.
--
-- Design notes
-- ------------
-- 1. New table `product_images` holds (id, product_id, image_url,
--    display_order, is_cover, created_at). Indexed on (product_id,
--    display_order) for ordered fetches.
--
-- 2. Partial unique index `product_images_one_cover_per_product_uidx` enforces
--    at most one row per `product_id` with `is_cover = TRUE`. We CANNOT use a
--    DEFERRABLE constraint on a partial unique index in PostgreSQL, so the
--    trigger below handles cover swaps atomically:
--
--      - When a row is INSERTed/UPDATEd to `is_cover = TRUE`, the trigger
--        first clears the cover flag on every other row of the same product
--        (within the same statement), then lets the new row keep its TRUE.
--      - When the cover row is DELETEd, the trigger promotes the lowest
--        `display_order` remaining row to cover (or leaves the product with
--        no cover if there are no images left).
--
-- 3. Backward compatibility — `products.image_url` is preserved. A second
--    trigger on `product_images` keeps `products.image_url` in sync with the
--    current cover image:
--
--      - INSERT/UPDATE of a cover row → write its `image_url` into
--        `products.image_url`.
--      - DELETE of the cover (or unset) → either promote a sibling
--        (handled by trigger #1, which then triggers this sync via the
--        promotion UPDATE) or NULL out `products.image_url`.
--
-- 4. Data migration: every existing `products.image_url` IS NOT NULL row gets
--    a corresponding `product_images` row with `is_cover = TRUE,
--    display_order = 0`. Idempotent — only inserts when no cover row exists
--    for that product yet.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_cover      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_images_product_order_idx
  ON public.product_images (product_id, display_order);

-- Max one cover per product. Partial unique index — only the rows with
-- is_cover = TRUE participate in the uniqueness check.
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_cover_per_product_uidx
  ON public.product_images (product_id)
  WHERE is_cover = TRUE;

-- ----------------------------------------------------------------------------
-- 2. Triggers — keep at most one cover, promote on delete, sync products.image_url
-- ----------------------------------------------------------------------------

-- Trigger A: when a row becomes cover, clear cover flag on its siblings.
-- BEFORE INSERT/UPDATE so the partial unique index never sees two TRUE rows
-- in the same statement.
CREATE OR REPLACE FUNCTION public.product_images_enforce_single_cover()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Trigger B: after a cover is removed (DELETE or is_cover flipped FALSE), if
-- the product still has images and no cover remains, promote the lowest
-- display_order survivor.
CREATE OR REPLACE FUNCTION public.product_images_promote_cover()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID;
  v_has_cover  BOOLEAN;
  v_promote_id UUID;
BEGIN
  -- Resolve the product_id from the relevant row (OLD on DELETE / UPDATE,
  -- NEW would do for UPDATE but OLD is the only one defined for DELETE).
  IF (TG_OP = 'DELETE') THEN
    v_product_id := OLD.product_id;
    -- Only promote if the deleted row was the cover.
    IF OLD.is_cover = FALSE THEN
      RETURN OLD;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_product_id := NEW.product_id;
    -- Only act when the row stopped being cover.
    IF NOT (OLD.is_cover = TRUE AND NEW.is_cover = FALSE) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Does any cover exist now? (Trigger A may have set one already.)
  SELECT EXISTS (
    SELECT 1 FROM public.product_images
     WHERE product_id = v_product_id AND is_cover = TRUE
  ) INTO v_has_cover;

  IF v_has_cover THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Promote the lowest display_order, then created_at, then id (deterministic).
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
    -- No images left — make sure products.image_url is NULL.
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

-- Trigger C: keep products.image_url in sync with the current cover image.
CREATE OR REPLACE FUNCTION public.product_images_sync_legacy_url()
RETURNS TRIGGER
LANGUAGE plpgsql
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
    -- The promote trigger handles repointing image_url when the cover is
    -- promoted onto another row. If no rows remain, the promote trigger
    -- already NULLs products.image_url, so we have nothing to do here.
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

-- ----------------------------------------------------------------------------
-- 3. Data migration — populate from existing products.image_url
-- ----------------------------------------------------------------------------
-- Idempotent: skip products that already have a cover row.
INSERT INTO public.product_images (product_id, image_url, display_order, is_cover)
SELECT p.id, p.image_url, 0, TRUE
  FROM public.products p
 WHERE p.image_url IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.product_images pi
      WHERE pi.product_id = p.id AND pi.is_cover = TRUE
   );

-- ----------------------------------------------------------------------------
-- 4. RLS policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

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

-- ----------------------------------------------------------------------------
-- 5. RPC: atomic "set this image as cover".
-- ----------------------------------------------------------------------------
-- The single-cover trigger handles concurrent flips, but exposing a single
-- RPC keeps the API code simple and gives us SECURITY DEFINER for the rare
-- case where the call is made through the anon-authenticated client. Admin
-- routes go through the service-role client and bypass RLS anyway, so this
-- is mostly defensive.
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
