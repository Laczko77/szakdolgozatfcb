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
