-- ============================================================================
-- 018_iter22_follows_status.sql
-- Iteration 22 — Follow rendszer jóváhagyás-alapúvá alakítása.
--
-- Korábban a `follows` egy egyszerű (follower, following) párként működött,
-- és a sor puszta léte azonnali "follow"-ot jelentett. Iter22-től a követés
-- jóváhagyás-alapú: a követni kívánó user `pending` állapotú sort hoz létre,
-- és a célszemély `accepted`-re állíthatja vagy törölheti.
--
-- Visszafelé kompatibilitás:
--   - Minden meglévő sort `accepted`-re állítunk, hogy a korábban kialakult
--     mutual-follow-on alapuló DM-szálak ne szakadjanak meg.
--
-- RLS módosítás:
--   - `accepted` sorok továbbra is publikusan láthatók (követés-gráf publikus).
--   - `pending` sorokat CSAK a két érintett fél láthatja (follower / following),
--     hogy mások ne tudjanak róla, ki kit próbál követni.
--   - INSERT-nél a status kötelezően `pending` (a /accept endpoint UPDATE-eli).
--
-- A `is_mutual_follow` függvényt frissítjük, hogy csak `accepted` sorokat
-- vegyen figyelembe — ettől a DM-szál INSERT WITH CHECK policy automatikusan
-- helyesen viselkedik a backend kód módosítása nélkül is.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. status mező hozzáadása (idempotens)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'follows'
       AND column_name  = 'status'
  ) THEN
    ALTER TABLE public.follows
      ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'accepted'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Backfill: a már létező sorokat accepted-re állítjuk.
--    A DEFAULT 'pending' a most beszúrt sorokra vonatkozik; a meglévő rekordok
--    értéke a hozzáadott `pending` lett, de azokat retroaktívan el kell
--    fogadottnak tekinteni (visszafelé kompatibilitás).
-- ----------------------------------------------------------------------------

UPDATE public.follows
   SET status = 'accepted'
 WHERE status = 'pending';

-- ----------------------------------------------------------------------------
-- 3. Index a státusz-szűrésre (gyors GET /follow-requests)
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS follows_status_idx ON public.follows(status);

-- ----------------------------------------------------------------------------
-- 4. RLS policy-k újradefiniálása
-- ----------------------------------------------------------------------------

-- Régi "minden látható" SELECT policy eltávolítása.
DROP POLICY IF EXISTS "follows_select_public" ON public.follows;

-- 4a. Accepted sorok publikusan láthatók (követés-gráf publikus).
DROP POLICY IF EXISTS "follows_select_accepted_public" ON public.follows;
CREATE POLICY "follows_select_accepted_public"
  ON public.follows
  FOR SELECT
  TO anon, authenticated
  USING (status = 'accepted');

-- 4b. Pending sorokat csak az érintett felek (follower vagy following) láthatják.
DROP POLICY IF EXISTS "follows_select_pending_involved" ON public.follows;
CREATE POLICY "follows_select_pending_involved"
  ON public.follows
  FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND (auth.uid() = follower_id OR auth.uid() = following_id)
  );

-- 4c. INSERT csak saját follower_id-vel ÉS csak `pending` státusszal indulhat.
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own"
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND status = 'pending'
  );

-- 4d. UPDATE csak a célszemély (following_id) hajthat végre, és csak
--     `accepted`-re állíthatja a státuszt — a follower_id / following_id pár
--     nem módosítható (immutable a meglévő USING/WITH CHECK miatt).
DROP POLICY IF EXISTS "follows_update_target_accepts" ON public.follows;
CREATE POLICY "follows_update_target_accepts"
  ON public.follows
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = following_id AND status = 'pending')
  WITH CHECK (auth.uid() = following_id AND status = 'accepted');

-- 4e. DELETE: a follower (visszavonás / kikövetés) ÉS a following (elutasítás)
--     egyaránt törölhet.
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_involved" ON public.follows;
CREATE POLICY "follows_delete_involved"
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- ----------------------------------------------------------------------------
-- 5. is_mutual_follow frissítése: csak accepted sorok számítanak.
-- ----------------------------------------------------------------------------

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
