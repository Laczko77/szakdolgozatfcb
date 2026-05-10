import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  getTopScorers,
  type NormalizedTopScorer,
} from '@/lib/football-data'
import {
  isFresh,
  mapUpstreamError,
  parseCompetition,
  parseLimit,
  parseSeason,
} from '../_shared'

/**
 * GET /api/season/scorers-snapshot
 *
 * Top-N goal scorers for a competition+season as a single point-in-time
 * snapshot. The football-data.org free tier does NOT expose per-matchday
 * scorer history, so we explicitly signal that fact to the frontend with
 * `evolution_supported: false` — the /season page can fall back to an
 * entry-animation rather than a full bar-chart-race.
 *
 * Query params:
 *   - competition  alias `laliga` or numeric ID (default 2014)
 *   - season       Season *start* year (defaults to the current season)
 *   - limit        1..100 (default 10)
 *
 * Cache: re-uses the existing `scorers_cache` (Iter15) keyed by
 * (competition_id, season) — we always store the maximum limit for a key
 * and slice on read.
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100
const LOG_PREFIX = '[api/season/scorers-snapshot]'

interface CachedScorers {
  scorers: NormalizedTopScorer[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const competitionId = parseCompetition(searchParams.get('competition'))
  if (competitionId === null) {
    return errorResponse('Érvénytelen competition paraméter', 400)
  }
  const season = parseSeason(searchParams.get('season'))
  const limit = parseLimit(
    searchParams.get('limit'),
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT
  )

  const supabase = createServiceRoleClient()

  // ---- 1. Cache lookup ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('scorers_cache' as never)
    .select('data, cached_at')
    .eq('competition_id', competitionId)
    .eq('season', season)
    .maybeSingle<{ data: CachedScorers; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at, CACHE_TTL_MS)) {
    return NextResponse.json({
      scorers: cacheRow.data.scorers.slice(0, limit),
      cached_at: cacheRow.cached_at,
      season,
      competition_id: competitionId,
      evolution_supported: false,
    })
  }

  console.log(
    `${LOG_PREFIX} cache miss for competition=${competitionId} season=${season}, fetching upstream`
  )

  // ---- 2. Fetch upstream --------------------------------------------------
  let scorers: NormalizedTopScorer[]
  try {
    scorers = await getTopScorers(competitionId, season, MAX_LIMIT)
  } catch (err) {
    if (cacheRow) {
      console.warn(
        `${LOG_PREFIX} upstream failed, serving stale cache from ${cacheRow.cached_at}:`,
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({
        scorers: cacheRow.data.scorers.slice(0, limit),
        cached_at: cacheRow.cached_at,
        season,
        competition_id: competitionId,
        evolution_supported: false,
        stale: true,
      })
    }
    return mapUpstreamError(err)
  }

  // ---- 3. Persist cache ---------------------------------------------------
  const nowIso = new Date().toISOString()
  const payload: CachedScorers = { scorers }

  const { error: upsertError } = await supabase
    .from('scorers_cache' as never)
    .upsert(
      {
        competition_id: competitionId,
        season,
        data: payload,
        cached_at: nowIso,
      } as never,
      { onConflict: 'competition_id,season' }
    )

  if (upsertError) {
    console.error(`${LOG_PREFIX} cache upsert failed:`, upsertError.message)
  }

  return NextResponse.json({
    scorers: scorers.slice(0, limit),
    cached_at: nowIso,
    season,
    competition_id: competitionId,
    evolution_supported: false,
  })
}
