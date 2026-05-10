-- ============================================================================
-- Iteration 26 — Per-user dashboard widget preferences.
-- ============================================================================
--
-- Goal: every user can choose which dashboard widgets to show and in what
-- order. The catalogue of available widgets lives in TypeScript
-- (`src/lib/constants/dashboard-widgets.ts`), shared between backend and
-- frontend; the database stores only the user's chosen configuration.
--
-- Design notes
-- ------------
-- 1. One row per user — `user_id` is UNIQUE. The widget list lives in a
--    JSONB column so adding/removing widgets in the catalogue does not
--    require a schema migration. Validation happens in the API layer using
--    the catalogue constant.
--
-- 2. `widget_config` shape:
--      [
--        { "widget_id": "next_match",   "visible": true,  "order": 0 },
--        { "widget_id": "latest_news",  "visible": true,  "order": 1 },
--        ...
--      ]
--
-- 3. RLS — users see and modify only their own row; admins see everything
--    (consistent with the rest of the platform).
--
-- 4. Missing-row semantics — when a user has never customised their
--    dashboard, no row exists and the GET endpoint returns the default
--    configuration derived from the catalogue. The reset endpoint simply
--    DELETEs the row, which restores default behaviour on the next GET.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  widget_config JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The UNIQUE constraint on user_id already creates a btree index, so an
-- explicit secondary index would be redundant. We keep the comment as a
-- reminder of the access pattern (lookups are always user_id = auth.uid()).

-- ----------------------------------------------------------------------------
-- 2. updated_at trigger — reuses the global public.set_updated_at() helper.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS dashboard_preferences_set_updated_at
  ON public.dashboard_preferences;
CREATE TRIGGER dashboard_preferences_set_updated_at
  BEFORE UPDATE ON public.dashboard_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- SELECT — owner or admin.
DROP POLICY IF EXISTS "dashboard_preferences_select_own_or_admin"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_select_own_or_admin"
  ON public.dashboard_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- INSERT — only on the caller's own row.
DROP POLICY IF EXISTS "dashboard_preferences_insert_own"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_insert_own"
  ON public.dashboard_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE — only on the caller's own row, and the row must remain owned
-- by the caller after the update (defense against user_id rewrites).
DROP POLICY IF EXISTS "dashboard_preferences_update_own"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_update_own"
  ON public.dashboard_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE — owner or admin (admin override mirrors the rest of the platform).
DROP POLICY IF EXISTS "dashboard_preferences_delete_own_or_admin"
  ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_delete_own_or_admin"
  ON public.dashboard_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
