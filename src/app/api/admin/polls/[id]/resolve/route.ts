import { NextResponse, type NextRequest } from 'next/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import {
  awardPollWinners,
  POINTS_BUSINESS_RULE_SQLSTATE,
} from '@/lib/points'

/**
 * PUT /api/admin/polls/[id]/resolve
 *
 * Admin only. Closes a poll by setting its correct option, marking it
 * inactive, and crediting +50 points to every voter who picked correctly.
 *
 * Body (JSON): { correct_option: number }   // 0-based index into poll.options
 *
 * The actual mutations (lock, mark resolved, ledger writes, balance bumps)
 * happen inside the SECURITY DEFINER `resolve_poll()` Postgres RPC. See
 * `src/lib/points.ts` and `supabase/migrations/009_iter9_polls_and_points.sql`
 * for the contract.
 *
 * Idempotency: re-running with the same correct_option is safe — the RPC
 * skips voters who already have a credit row for this poll. Re-running with
 * a *different* correct_option returns 409 Conflict.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés tartalom', 400)
  }
  const obj = body as Record<string, unknown>

  if (
    typeof obj.correct_option !== 'number' ||
    !Number.isInteger(obj.correct_option) ||
    obj.correct_option < 0
  ) {
    return errorResponse(
      'A "correct_option" mező nem-negatív egész szám kell legyen',
      400
    )
  }

  const result = await awardPollWinners(id, obj.correct_option)

  if (result instanceof Error) {
    const code = (result as Error & { code?: string }).code
    if (code === POINTS_BUSINESS_RULE_SQLSTATE) {
      return errorResponse(result.message, 409)
    }
    return errorResponse(
      `Szavazás lezárása sikertelen: ${result.message}`,
      500
    )
  }

  return successResponse(result)
}
