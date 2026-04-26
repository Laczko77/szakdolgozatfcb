import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { PointTransaction, UserPoints } from '@/types/database'

/**
 * GET /api/profile/points
 *
 * Authenticated. Returns the caller's current point balance plus the full
 * transaction history (newest first).
 *
 * Both reads are RLS-bound to the authenticated user — see migration
 * 004 (user_points) and 007 (point_transactions). If the `user_points` row
 * is missing (e.g. the handle_new_user trigger did not run), we surface a
 * zeroed-out balance so the UI never crashes.
 */

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const [balanceRes, transactionsRes] = await Promise.all([
    supabase
      .from('user_points')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (balanceRes.error) {
    return errorResponse(
      `Pontegyenleg lekérése sikertelen: ${balanceRes.error.message}`,
      500
    )
  }
  if (transactionsRes.error) {
    return errorResponse(
      `Pont tranzakciók lekérése sikertelen: ${transactionsRes.error.message}`,
      500
    )
  }

  const balance = (balanceRes.data as UserPoints | null) ?? {
    // Stable fallback shape: same fields the client would read from a real row.
    id: '',
    user_id: user.id,
    balance: 0,
    total_earned: 0,
  }

  return NextResponse.json({
    balance: {
      balance: balance.balance,
      total_earned: balance.total_earned,
    },
    transactions: (transactionsRes.data ?? []) as PointTransaction[],
  })
}
