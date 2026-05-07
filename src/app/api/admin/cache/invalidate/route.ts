import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'

/**
 * POST /api/admin/cache/invalidate
 *
 * Admin-only. Wipes the standings + scorers caches so the next public
 * dashboard request re-fetches from football-data.org.
 *
 * Useful after a finished match: the upstream table / top-scorers list
 * has changed but the 1-hour TTL would otherwise serve stale data.
 *
 * Response: `{ standings: <rows-deleted>, scorers: <rows-deleted> }`.
 */

const LOG_PREFIX = '[admin/cache/invalidate]'

export async function POST() {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const supabase = createServiceRoleClient()

  // We delete everything in both tables. The cache rows are unique on
  // (competition_id, season), so the row count is small (typically <= 2)
  // and a full table delete is the simplest correct invalidation.
  const { error: standingsError, count: standingsDeleted } = await supabase
    .from('standings_cache' as never)
    .delete({ count: 'exact' })
    .not('id', 'is', null)

  if (standingsError) {
    return errorResponse(
      `standings_cache törlése sikertelen: ${standingsError.message}`,
      500
    )
  }

  const { error: scorersError, count: scorersDeleted } = await supabase
    .from('scorers_cache' as never)
    .delete({ count: 'exact' })
    .not('id', 'is', null)

  if (scorersError) {
    return errorResponse(
      `scorers_cache törlése sikertelen: ${scorersError.message}`,
      500
    )
  }

  console.log(
    `${LOG_PREFIX} invalidated by admin=${guard.user.id}: ` +
      `standings=${standingsDeleted ?? 0} scorers=${scorersDeleted ?? 0}`
  )

  return successResponse({
    standings: standingsDeleted ?? 0,
    scorers: scorersDeleted ?? 0,
  })
}
