-- ============================================================================
-- 009_iter9_polls_and_points.sql
-- RLS policies for the voting & points subsystem (Iteration 9), plus the
-- resolve_poll() RPC that atomically locks a poll, marks the correct option,
-- and awards points to the winning voters.
--
-- Scope:
--   - polls:              public read, admin INSERT/UPDATE/DELETE.
--   - votes:              user reads own + per-poll aggregation queries; user
--                         inserts only their own; UPDATE/DELETE forbidden.
--   - point_transactions: INSERT policy denied (no policy) — writes happen
--                         via the SECURITY DEFINER RPC below.
--   - user_points:        same — RPC writes via service-definer.
--
-- Idempotent: every policy and function is dropped IF EXISTS before recreate.
-- RLS itself was already enabled by 002_schema.sql.
-- ============================================================================

-- ============================================================================
-- polls  — public read, admin write.
-- ============================================================================

DROP POLICY IF EXISTS "polls_select_public" ON public.polls;
CREATE POLICY "polls_select_public"
  ON public.polls
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "polls_insert_admin" ON public.polls;
CREATE POLICY "polls_insert_admin"
  ON public.polls
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "polls_update_admin" ON public.polls;
CREATE POLICY "polls_update_admin"
  ON public.polls
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "polls_delete_admin" ON public.polls;
CREATE POLICY "polls_delete_admin"
  ON public.polls
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- votes
--
-- Read: a user can see their own vote rows; admins see everything. The
-- aggregate-by-option count is exposed via a separate dedicated public view
-- below so anonymous readers can render results without leaking individual
-- voter identities.
--
-- Insert: a user inserts only their own row (auth.uid() = user_id) AND only
-- on an active poll. The unique (poll_id, user_id) constraint blocks doubles.
--
-- Update / Delete: no policy = deny.
-- ============================================================================

DROP POLICY IF EXISTS "votes_select_own_or_admin" ON public.votes;
CREATE POLICY "votes_select_own_or_admin"
  ON public.votes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "votes_insert_own_active" ON public.votes;
CREATE POLICY "votes_insert_own_active"
  ON public.votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.polls p
       WHERE p.id = votes.poll_id
         AND p.is_active = TRUE
    )
  );

-- ----------------------------------------------------------------------------
-- poll_results  — public-readable aggregate view (option index -> vote count)
-- A view sidesteps the votes RLS so anonymous visitors can see how the totals
-- look without being able to enumerate individual voters.
--
-- security_invoker=off (default) is fine here: the view exposes only counts,
-- never identifying columns.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.poll_results AS
SELECT poll_id,
       selected_option,
       COUNT(*)::INTEGER AS vote_count
FROM public.votes
GROUP BY poll_id, selected_option;

GRANT SELECT ON public.poll_results TO anon, authenticated;

-- ============================================================================
-- resolve_poll()
--
-- Atomically:
--   1. Locks the poll row.
--   2. Validates that the supplied correct_option is in range against the
--      current options array (jsonb_array_length).
--   3. Sets correct_option, is_active = false.
--   4. For each voter who picked the correct option AND has not yet been
--      credited for this poll (point_transactions.poll_id check), inserts a
--      +50 point_transactions row and bumps user_points (balance + total_earned).
--      Missing user_points rows are inserted on demand (defensive: trigger
--      handle_new_user() should already have created them).
--
-- Returns: { winners_credited: int, already_credited: int, total_correct: int }
--
-- Idempotency: re-running resolve_poll on an already-resolved poll with the
-- same correct_option short-circuits (winners_credited = 0, already_credited
-- equals the existing transaction count). Re-running with a *different*
-- correct_option raises P0001 — historical scoring is not retroactively
-- reshuffled.
--
-- Errors (SQLSTATE P0001):
--   - poll not found
--   - correct_option out of range
--   - poll already resolved with a different correct_option
-- ============================================================================

DROP FUNCTION IF EXISTS public.resolve_poll(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.resolve_poll(
  p_poll_id        UUID,
  p_correct_option INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll              public.polls%ROWTYPE;
  v_option_count      INTEGER;
  v_winner_reward     CONSTANT INTEGER := 50;
  v_total_correct     INTEGER := 0;
  v_winners_credited  INTEGER := 0;
  v_already_credited  INTEGER := 0;
  v_voter             RECORD;
  v_already_paid      BOOLEAN;
BEGIN
  -- Lock the poll row to serialize concurrent resolve attempts.
  SELECT *
    INTO v_poll
    FROM public.polls
   WHERE id = p_poll_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott szavazás nem található'
      USING ERRCODE = 'P0001';
  END IF;

  -- Range-check the correct option against the options jsonb array.
  v_option_count := jsonb_array_length(v_poll.options);

  IF p_correct_option IS NULL
     OR p_correct_option < 0
     OR p_correct_option >= v_option_count THEN
    RAISE EXCEPTION 'Érvénytelen helyes válasz index (opciók száma: %)', v_option_count
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: if the poll is already resolved, the only legal call is one
  -- that confirms the same correct_option; we then short-circuit without
  -- re-paying winners.
  IF v_poll.correct_option IS NOT NULL THEN
    IF v_poll.correct_option <> p_correct_option THEN
      RAISE EXCEPTION 'A szavazás már le van zárva eltérő helyes válasszal'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Mark the poll resolved (idempotent — same values overwritten).
  UPDATE public.polls
     SET correct_option = p_correct_option,
         is_active      = FALSE
   WHERE id = p_poll_id;

  -- Iterate winning voters and credit each who has not already been paid.
  FOR v_voter IN
    SELECT user_id
      FROM public.votes
     WHERE poll_id = p_poll_id
       AND selected_option = p_correct_option
  LOOP
    v_total_correct := v_total_correct + 1;

    -- Has this user already been credited for this poll?
    SELECT EXISTS (
      SELECT 1
        FROM public.point_transactions pt
       WHERE pt.user_id = v_voter.user_id
         AND pt.poll_id = p_poll_id
    ) INTO v_already_paid;

    IF v_already_paid THEN
      v_already_credited := v_already_credited + 1;
      CONTINUE;
    END IF;

    -- Defensive: ensure user_points row exists for this user.
    INSERT INTO public.user_points (user_id, balance, total_earned)
    VALUES (v_voter.user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Bump balance and lifetime earnings.
    UPDATE public.user_points
       SET balance      = balance + v_winner_reward,
           total_earned = total_earned + v_winner_reward
     WHERE user_id = v_voter.user_id;

    -- Ledger entry.
    INSERT INTO public.point_transactions (user_id, amount, reason, poll_id)
    VALUES (v_voter.user_id, v_winner_reward, 'poll_win', p_poll_id);

    v_winners_credited := v_winners_credited + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'winners_credited',  v_winners_credited,
    'already_credited',  v_already_credited,
    'total_correct',     v_total_correct,
    'reward_per_winner', v_winner_reward
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_poll(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_poll(UUID, INTEGER) TO service_role;
