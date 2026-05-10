-- ============================================================================
-- Patch: pin search_path on the three product_images trigger functions.
-- Supabase linter lint=0011 (function_search_path_mutable) flagged these
-- because the original CREATE OR REPLACE omitted SET search_path.
-- Run this once against the live database — safe to re-run (OR REPLACE).
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
