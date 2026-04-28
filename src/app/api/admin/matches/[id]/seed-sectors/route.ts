import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { seedFixedSectorsForMatch } from '@/lib/sectors-seed'

/**
 * POST /api/admin/matches/[id]/seed-sectors
 *
 * Admin-only safety net. Idempotently creates the four fixed sectors for a
 * given match (TRIBUNA, LATERAL, GOL NORD, GOL SUD). Used when a match
 * exists in the DB without its sector rows (e.g. it was created manually
 * before the auto-seed in /api/admin/matches/sync was deployed).
 *
 * Re-running this endpoint is safe: existing sector rows are preserved,
 * only missing ones are inserted. Admin-edited price / capacity values are
 * never overwritten.
 *
 * Returns: { matchId, inserted } where `inserted` is the number of newly
 * created sector rows (0 if all four already existed).
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: matchId } = await context.params
  if (!matchId) return errorResponse('Hiányzó meccs azonosító', 400)

  const supabase = createServiceRoleClient()

  // Friendlier 404 than letting the FK violation bubble up from the seed.
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id')
    .eq('id', matchId)
    .maybeSingle()

  if (matchError) {
    return errorResponse(`Meccs lekérése sikertelen: ${matchError.message}`, 500)
  }
  if (!match) {
    return errorResponse('A megadott meccs nem található', 404)
  }

  const result = await seedFixedSectorsForMatch(supabase, matchId)
  if (result.error) {
    return errorResponse(`Szektor seed sikertelen: ${result.error}`, 500)
  }

  return successResponse({ matchId, inserted: result.inserted }, 201)
}
