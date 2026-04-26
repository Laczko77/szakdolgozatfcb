import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type { MatchSector, TablesUpdate } from '@/types/database'

/**
 * PUT /api/admin/matches/[id]/sectors/[sectorId]
 *
 * Admin only. Partial update of a sector (extra ticket allotment, rename,
 * price change). All fields are optional; if `total_seats` is provided it
 * must be >= the current `sold_seats` value (database CHECK constraint
 * enforces this too, but we want a friendlier error).
 *
 * Body (JSON): { sector_name?: string, total_seats?: number, price?: number }
 *
 * Note: `sold_seats` is NOT settable by this endpoint. It is only mutated
 * by the purchase_tickets() RPC.
 */

type RouteContext = {
  params: Promise<{ id: string; sectorId: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: matchId, sectorId } = await context.params
  if (!matchId || !sectorId) {
    return errorResponse('Hiányzó azonosító', 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  const patch = parsePatch(body)
  if (patch instanceof Error) {
    return errorResponse(patch.message, 400)
  }
  if (Object.keys(patch).length === 0) {
    return errorResponse('Nincs frissítendő mező', 400)
  }

  const supabase = await createClient()

  // Load current row to validate that the sector belongs to the match
  // and that the new total_seats is not below the already-sold count.
  const { data: existing, error: fetchError } = await supabase
    .from('match_sectors')
    .select('*')
    .eq('id', sectorId)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Szektor lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('A szektor nem található', 404)
  }
  const sector = existing as MatchSector

  if (sector.match_id !== matchId) {
    return errorResponse('A szektor nem ehhez a meccshez tartozik', 400)
  }

  if (
    typeof patch.total_seats === 'number' &&
    patch.total_seats < sector.sold_seats
  ) {
    return errorResponse(
      `A "total_seats" nem lehet kisebb mint a már eladott jegyek száma (${sector.sold_seats})`,
      400
    )
  }

  const update: TablesUpdate<'match_sectors'> = patch

  const { data, error } = await supabase
    .from('match_sectors')
    .update(update as never)
    .eq('id', sectorId)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Szektor frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as MatchSector)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SectorPatch = {
  sector_name?: string
  total_seats?: number
  price?: number
}

function parsePatch(raw: unknown): SectorPatch | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen kérés tartalom')
  }
  const obj = raw as Record<string, unknown>
  const out: SectorPatch = {}

  if (obj.sector_name !== undefined) {
    if (typeof obj.sector_name !== 'string' || obj.sector_name.trim().length === 0) {
      return new Error('A "sector_name" mező nem-üres szöveg kell legyen')
    }
    out.sector_name = obj.sector_name.trim()
  }
  if (obj.total_seats !== undefined) {
    if (
      typeof obj.total_seats !== 'number' ||
      !Number.isInteger(obj.total_seats) ||
      obj.total_seats < 0
    ) {
      return new Error('A "total_seats" mező nem-negatív egész szám kell legyen')
    }
    out.total_seats = obj.total_seats
  }
  if (obj.price !== undefined) {
    if (typeof obj.price !== 'number' || !Number.isFinite(obj.price) || obj.price < 0) {
      return new Error('A "price" mező nem-negatív szám kell legyen')
    }
    out.price = obj.price
  }

  return out
}
