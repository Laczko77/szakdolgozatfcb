import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type { MatchSector, TablesInsert } from '@/types/database'

/**
 * POST /api/admin/matches/[id]/sectors
 *
 * Admin only. Creates a new sector for the given match.
 *
 * Body (JSON): { sector_name: string, total_seats: number, price: number }
 *
 * Validation rules:
 *   - sector_name must be non-empty.
 *   - total_seats must be a non-negative integer.
 *   - price must be a non-negative number.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: matchId } = await context.params
  if (!matchId) return errorResponse('Hiányzó meccs azonosító', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  const parsed = parseSectorPayload(body)
  if (parsed instanceof Error) {
    return errorResponse(parsed.message, 400)
  }

  const supabase = await createClient()

  // Confirm the match exists; otherwise the FK insert below would 23503 us
  // and we can give a friendlier message.
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

  const insert: TablesInsert<'match_sectors'> = {
    match_id: matchId,
    sector_name: parsed.sector_name,
    total_seats: parsed.total_seats,
    price: parsed.price,
  }

  const { data, error } = await supabase
    .from('match_sectors')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Szektor létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as MatchSector, 201)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SectorPayload = {
  sector_name: string
  total_seats: number
  price: number
}

function parseSectorPayload(raw: unknown): SectorPayload | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen kérés tartalom')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.sector_name !== 'string' || obj.sector_name.trim().length === 0) {
    return new Error('A "sector_name" mező kötelező')
  }
  if (
    typeof obj.total_seats !== 'number' ||
    !Number.isInteger(obj.total_seats) ||
    obj.total_seats < 0
  ) {
    return new Error('A "total_seats" mező nem-negatív egész szám kell legyen')
  }
  if (typeof obj.price !== 'number' || !Number.isFinite(obj.price) || obj.price < 0) {
    return new Error('A "price" mező nem-negatív szám kell legyen')
  }

  return {
    sector_name: obj.sector_name.trim(),
    total_seats: obj.total_seats,
    price: obj.price,
  }
}
