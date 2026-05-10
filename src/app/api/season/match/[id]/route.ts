import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  FootballDataConfigError,
  FootballDataRequestError,
  getMatchDetails,
  type MatchDetails,
} from '@/lib/football-data'
import { buildCacheKey, isFresh, mapUpstreamError } from '../../_shared'

/**
 * GET /api/season/match/[id]
 *
 * Detailed event timeline (goals / bookings / substitutions) for a single
 * match. The `id` here is the football-data.org match ID — historically
 * also stored as `matches.api_football_id` in the local database, but this
 * endpoint does NOT touch the local table; it is a thin cached pass-through
 * to football-data.org.
 *
 * Cache TTL:
 *   - 24h for finished matches (`status = 'FT'`)
 *   - 5 min for in-progress matches (`status = 'LIVE'`)
 *   - 1h for everything else (NS, PP, etc.) — events may still arrive late
 *
 * Response:
 *   {
 *     match: { id, utcDate, status, homeTeam, awayTeam, score },
 *     events: { goals: [...], bookings: [...], substitutions: [...] },
 *     data_quality: 'full' | 'partial' | 'unavailable',
 *     cached_at,
 *     stale?: true
 *   }
 */

const TTL_FINISHED_MS = 24 * 60 * 60 * 1000
const TTL_LIVE_MS = 5 * 60 * 1000
const TTL_OTHER_MS = 60 * 60 * 1000
const LOG_PREFIX = '[api/season/match/[id]]'

type DataQuality = 'full' | 'partial' | 'unavailable'

interface MatchEventsPayload {
  match: {
    id: number
    utcDate: string
    status: MatchDetails['status']
    homeTeam: MatchDetails['homeTeam']
    awayTeam: MatchDetails['awayTeam']
    score: MatchDetails['score']
  }
  events: {
    goals: MatchDetails['goals']
    bookings: MatchDetails['bookings']
    substitutions: MatchDetails['substitutions']
  }
  data_quality: DataQuality
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const matchId = Number.parseInt(id, 10)
  if (!Number.isInteger(matchId) || matchId < 1) {
    return errorResponse('Érvénytelen meccs azonosító', 400)
  }
  const cacheKey = buildCacheKey(['match', matchId])

  const supabase = createServiceRoleClient()

  // ---- 1. Cache lookup ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('match_details_cache' as never)
    .select('data, cached_at')
    .eq('cache_key', cacheKey)
    .maybeSingle<{ data: MatchEventsPayload; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at, ttlForStatus(cacheRow.data.match.status))) {
    return NextResponse.json({
      ...cacheRow.data,
      cached_at: cacheRow.cached_at,
    })
  }

  console.log(`${LOG_PREFIX} cache miss for match=${matchId}, fetching upstream`)

  // ---- 2. Fetch upstream --------------------------------------------------
  let details: MatchDetails
  try {
    details = await getMatchDetails(matchId)
  } catch (err) {
    // Distinguish a "match not found" (404 upstream) from other failures —
    // we still want to return a helpful payload so the frontend can render
    // an "events unavailable" state instead of a hard error.
    if (err instanceof FootballDataRequestError && err.status === 404) {
      return errorResponse('A megadott meccs nem található', 404)
    }

    if (cacheRow) {
      console.warn(
        `${LOG_PREFIX} upstream failed, serving stale cache from ${cacheRow.cached_at}:`,
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({
        ...cacheRow.data,
        cached_at: cacheRow.cached_at,
        stale: true,
      })
    }

    // No cache at all — emit an "unavailable" payload (with a clear error
    // status) so the frontend has a stable shape to consume.
    if (
      err instanceof FootballDataConfigError ||
      err instanceof FootballDataRequestError
    ) {
      return mapUpstreamError(err)
    }
    return mapUpstreamError(err)
  }

  // ---- 3. Build payload + persist ----------------------------------------
  const payload: MatchEventsPayload = {
    match: {
      id: details.id,
      utcDate: details.utcDate,
      status: details.status,
      homeTeam: details.homeTeam,
      awayTeam: details.awayTeam,
      score: details.score,
    },
    events: {
      goals: details.goals,
      bookings: details.bookings,
      substitutions: details.substitutions,
    },
    data_quality: deriveDataQuality(details),
  }

  const nowIso = new Date().toISOString()
  const { error: upsertError } = await supabase
    .from('match_details_cache' as never)
    .upsert(
      {
        cache_key: cacheKey,
        data: payload,
        cached_at: nowIso,
      } as never,
      { onConflict: 'cache_key' }
    )

  if (upsertError) {
    console.error(`${LOG_PREFIX} cache upsert failed:`, upsertError.message)
  }

  return NextResponse.json({
    ...payload,
    cached_at: nowIso,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ttlForStatus(status: MatchDetails['status']): number {
  if (status === 'FT' || status === 'AWD') return TTL_FINISHED_MS
  if (status === 'LIVE') return TTL_LIVE_MS
  return TTL_OTHER_MS
}

/**
 * `full`         — all three event categories present (only meaningful for
 *                  finished matches).
 * `partial`      — at least one category empty for a finished match.
 * `unavailable`  — match is not finished yet, so missing arrays are
 *                  expected and the data quality marker should not flag
 *                  them as a deficiency.
 */
function deriveDataQuality(details: MatchDetails): DataQuality {
  if (details.status !== 'FT' && details.status !== 'AWD') {
    return 'unavailable'
  }
  const allPresent =
    details.goals.length > 0 &&
    details.bookings.length > 0 &&
    details.substitutions.length > 0
  return allPresent ? 'full' : 'partial'
}
