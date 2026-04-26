import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Match, MatchSector } from '@/types/database'

/**
 * GET /api/matches/[id]
 *
 * Public detail endpoint: returns the match together with its sector list.
 * Each sector is decorated with `available_seats = total_seats - sold_seats`
 * and `is_sold_out` for convenience on the frontend.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

type SectorWithAvailability = MatchSector & {
  available_seats: number
  is_sold_out: boolean
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (matchError) {
    return errorResponse(`Meccs lekérése sikertelen: ${matchError.message}`, 500)
  }
  if (!match) {
    return errorResponse('A megadott meccs nem található', 404)
  }

  const { data: sectorRows, error: sectorsError } = await supabase
    .from('match_sectors')
    .select('*')
    .eq('match_id', id)
    .order('sector_name', { ascending: true })

  if (sectorsError) {
    return errorResponse(
      `Szektorok lekérése sikertelen: ${sectorsError.message}`,
      500
    )
  }

  const sectors: SectorWithAvailability[] = ((sectorRows ?? []) as MatchSector[]).map(
    (s) => {
      const available = Math.max(0, s.total_seats - s.sold_seats)
      return {
        ...s,
        available_seats: available,
        is_sold_out: available === 0,
      }
    }
  )

  return NextResponse.json({
    match: match as Match,
    sectors,
  })
}
