-- ============================================================================
-- 001_storage_buckets.sql
-- Creates the 5 public Supabase Storage buckets used by the FC Barcelona
-- Fan Portal. Idempotent: safe to re-run.
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

-- ----------------------------------------------------------------------------
-- Public-read policies on storage.objects for each bucket.
-- Write/update/delete policies are added by per-feature migrations
-- (e.g. only the post author may delete a post-images object).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  bucket_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH bucket_name IN ARRAY ARRAY[
    'profile-images',
    'article-images',
    'player-images',
    'product-images',
    'post-images'
  ]
  LOOP
    policy_name := 'Public read ' || bucket_name;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename  = 'objects'
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)',
        policy_name, bucket_name
      );
    END IF;
  END LOOP;
END $$;
