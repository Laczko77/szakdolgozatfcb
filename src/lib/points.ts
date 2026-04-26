import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Points subsystem helpers.
 *
 * The heavy lifting (locking, bookkeeping, transactional writes) is performed
 * by the `resolve_poll()` PostgreSQL RPC defined in migration
 * 009_iter9_polls_and_points.sql. This module is a thin TypeScript wrapper
 * that exposes that RPC and the canonical reward constants to API route
 * handlers.
 *
 * Why an RPC and not application-level SQL:
 *   - Multiple writes (point_transactions INSERT + user_points UPDATE) must
 *     succeed atomically.
 *   - Concurrent resolve attempts on the same poll must serialize (FOR UPDATE
 *     row lock).
 *   - Idempotency: re-running resolve must not double-pay winners.
 */

export const POLL_WINNER_REWARD = 50

/**
 * Reasons used in `point_transactions.reason`. Kept as a string union so the
 * frontend can switch on them safely without coupling to backend constants.
 */
export type PointTransactionReason = 'poll_win'

export type ResolvePollResult = {
  winners_credited: number
  already_credited: number
  total_correct: number
  reward_per_winner: number
}

/**
 * Resolve a poll: persist the correct option, mark the poll inactive, and
 * award {@link POLL_WINNER_REWARD} points to every voter who picked the
 * correct option (idempotent — voters already credited for this poll are
 * skipped).
 *
 * Returns the RPC result on success or an Error describing the business-rule
 * violation (P0001) / Postgres error otherwise. Callers map to HTTP status
 * codes:
 *   - business-rule violation → 409 Conflict
 *   - other Postgres error    → 500
 */
export async function awardPollWinners(
  pollId: string,
  correctOption: number
): Promise<ResolvePollResult | Error> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc('resolve_poll', {
    p_poll_id: pollId,
    p_correct_option: correctOption,
  } as never)

  if (error) {
    const wrapped = new Error(error.message)
    // Carry the SQLSTATE through so callers can distinguish business-rule
    // violations from infrastructure errors.
    ;(wrapped as Error & { code?: string }).code =
      (error as { code?: string }).code
    return wrapped
  }

  // `resolve_poll` returns a jsonb object — runtime-validate the shape before
  // handing back to TypeScript callers.
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return new Error('Pontszétosztás váratlan választ adott')
  }

  const obj = data as Record<string, unknown>
  if (
    typeof obj.winners_credited !== 'number' ||
    typeof obj.already_credited !== 'number' ||
    typeof obj.total_correct !== 'number' ||
    typeof obj.reward_per_winner !== 'number'
  ) {
    return new Error('Pontszétosztás váratlan választ adott')
  }

  return {
    winners_credited: obj.winners_credited,
    already_credited: obj.already_credited,
    total_correct: obj.total_correct,
    reward_per_winner: obj.reward_per_winner,
  }
}

/**
 * SQLSTATE used by resolve_poll() for business-rule violations.
 */
export const POINTS_BUSINESS_RULE_SQLSTATE = 'P0001'
