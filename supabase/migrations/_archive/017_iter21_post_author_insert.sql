-- ============================================================================
-- 017_iter21_post_author_insert.sql
-- Iteration 21 — Közösségi modul backend hibajavítás.
--
-- Eredeti viselkedés (008_iter8_rls_policies.sql): a public.posts INSERT
-- policy admin-only volt. A 21.3 feladat szerint normál usernek is engednünk
-- kell saját poszt létrehozását — author_id = auth.uid() ellenőrzéssel.
--
-- A 008-as admin policy MARAD (külön permissive policy), ez csak hozzáad egy
-- új permissive INSERT policy-t. PostgreSQL két permissive policy-t OR-olva
-- kombinál, így admin továbbra is bármilyen author_id-vel posztolhat (pl.
-- felülbírált szerző esetén), de ezt a route handler nem használja.
--
-- Storage: a post-images bucketbe authenticated userek tölthetnek fel saját
-- prefix-szel ({user_id}/...). Ez NEM ad jogot mások prefixébe írni.
--
-- Idempotens: minden policy DROP IF EXISTS-szel kezdődik.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- public.posts — saját szerzőséggel INSERT
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "posts_insert_own_author" ON public.posts;
CREATE POLICY "posts_insert_own_author"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- A user a SAJÁT posztját törölheti. Az admin törlés policy (008) marad.
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- storage.objects — post-images bucket: authenticated felhasználó saját
-- prefix-be ({user_id}/...) tölthet fel és törölhet.
--
-- A public read policy a 001_storage_buckets.sql-ben már létezik.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "post_images_insert_own_prefix" ON storage.objects;
CREATE POLICY "post_images_insert_own_prefix"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "post_images_delete_own_prefix" ON storage.objects;
CREATE POLICY "post_images_delete_own_prefix"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
