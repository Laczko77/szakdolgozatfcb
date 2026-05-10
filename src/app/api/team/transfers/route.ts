import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  ApiFootballConfigError,
  ApiFootballRequestError,
  getSofascoreTransfers,
  type SofascoreTransfersPayload,
} from '@/lib/api-football'
import { isFresh } from '../../season/_shared'

/**
 * GET /api/team/transfers
 *
 * FCB átigazolási feed (érkezők + távozók) — singleton cache, mert a
 * Sofascore endpoint nem fogad paramétert.
 *
 * Response:
 *   { transfers: { transfersIn: [...], transfersOut: [...] }, cached_at }
 *
 * Cache: 24 óra, `team_transfers_cache`. Auth: nem szükséges, publikus.
 */

const CACHE_KEY = 'transfers'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LOG_PREFIX = '[api/team/transfers]'

interface CachedTransfers {
  transfers: SofascoreTransfersPayload
}

export async function GET(_request: NextRequest) {
  const supabase = createServiceRoleClient()

  // ---- 1. Cache lookup ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('team_transfers_cache' as never)
    .select('data, cached_at')
    .eq('cache_key', CACHE_KEY)
    .maybeSingle<{ data: CachedTransfers; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at, CACHE_TTL_MS)) {
    return NextResponse.json({
      transfers: cacheRow.data.transfers,
      cached_at: cacheRow.cached_at,
    })
  }

  // ---- 2. Upstream fetch --------------------------------------------------
  let transfers: SofascoreTransfersPayload
  try {
    transfers = await getSofascoreTransfers()
  } catch (err) {
    if (cacheRow) {
      console.warn(
        `${LOG_PREFIX} upstream failed, serving stale cache from ${cacheRow.cached_at}:`,
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({
        transfers: cacheRow.data.transfers,
        cached_at: cacheRow.cached_at,
        stale: true,
      })
    }
    return mapSofascoreError(err)
  }

  // ---- 3. Persist cache ---------------------------------------------------
  const nowIso = new Date().toISOString()
  const payload: CachedTransfers = { transfers }

  const { error: upsertError } = await supabase
    .from('team_transfers_cache' as never)
    .upsert(
      {
        cache_key: CACHE_KEY,
        data: payload,
        cached_at: nowIso,
      } as never,
      { onConflict: 'cache_key' }
    )
  if (upsertError) {
    console.error(`${LOG_PREFIX} cache upsert failed:`, upsertError.message)
  }

  return NextResponse.json({
    transfers,
    cached_at: nowIso,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapSofascoreError(err: unknown): NextResponse {
  if (err instanceof ApiFootballConfigError) {
    return errorResponse(
      'A Sofascore API kulcs nincs beállítva (SOFASCORE_RAPIDAPI_KEY)',
      503
    )
  }
  if (err instanceof ApiFootballRequestError) {
    return errorResponse(
      `Sofascore nem elérhető: ${err.message}`,
      err.status === 429 ? 429 : 503
    )
  }
  return errorResponse(
    err instanceof Error ? `Sofascore hiba: ${err.message}` : 'Sofascore hiba',
    503
  )
}
