import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'

/**
 * POST /api/admin/season/refresh
 *
 * Admin-only. Wipes the three /season-page caches so the next public
 * request re-fetches from football-data.org. Useful immediately after a
 * matchday concludes — the regular TTLs (12h evolution, 1h form, 24h
 * match details) would otherwise serve stale data for hours.
 *
 * Note: the standings / scorers / scorers-snapshot caches are still
 * invalidated through the existing `/api/admin/cache/invalidate` route;
 * this endpoint only covers the new /season tables.
 *
 * Response: `{ evolution: <rows>, form: <rows>, match_details: <rows> }`.
 */

const LOG_PREFIX = '[admin/season/refresh]'

export async function POST() {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const supabase = createServiceRoleClient()

  const { error: evolutionError, count: evolutionDeleted } = await supabase
    .from('season_evolution_cache' as never)
    .delete({ count: 'exact' })
    .not('id', 'is', null)

  if (evolutionError) {
    return errorResponse(
      `season_evolution_cache törlése sikertelen: ${evolutionError.message}`,
      500
    )
  }

  const { error: formError, count: formDeleted } = await supabase
    .from('season_form_cache' as never)
    .delete({ count: 'exact' })
    .not('id', 'is', null)

  if (formError) {
    return errorResponse(
      `season_form_cache törlése sikertelen: ${formError.message}`,
      500
    )
  }

  const { error: detailsError, count: detailsDeleted } = await supabase
    .from('match_details_cache' as never)
    .delete({ count: 'exact' })
    .not('id', 'is', null)

  if (detailsError) {
    return errorResponse(
      `match_details_cache törlése sikertelen: ${detailsError.message}`,
      500
    )
  }

  console.log(
    `${LOG_PREFIX} invalidated by admin=${guard.user.id}: ` +
      `evolution=${evolutionDeleted ?? 0} form=${formDeleted ?? 0} ` +
      `match_details=${detailsDeleted ?? 0}`
  )

  return successResponse({
    evolution: evolutionDeleted ?? 0,
    form: formDeleted ?? 0,
    match_details: detailsDeleted ?? 0,
  })
}
