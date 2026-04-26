-- ============================================================================
-- 003_auth_trigger.sql
-- Provisions profile + points rows automatically when a new auth.users entry
-- is inserted (covers email/password sign-up AND OAuth sign-in).
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- handle_new_user()
--
-- Runs as SECURITY DEFINER so it can write to public.profiles and
-- public.user_points regardless of the authenticated role at sign-up time.
-- search_path is pinned to `public` to defeat search_path hijacking — this is
-- the standard hardening pattern for SECURITY DEFINER functions in Supabase.
--
-- Username resolution order:
--   1. raw_user_meta_data->>'username'  (set by our /signup form)
--   2. local part of the email          (fallback for OAuth users)
--
-- ON CONFLICT DO NOTHING makes the trigger safe against:
--   - replay (e.g. user deletes account in auth, re-signs up with same id —
--     unlikely but cheap to guard)
--   - manual seed scripts that pre-populate profiles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_points (user_id, balance, total_earned)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Trigger binding on auth.users.
-- AFTER INSERT so the auth row is committed before we reference it.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
