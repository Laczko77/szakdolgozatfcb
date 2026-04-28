import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  FootballDataConfigError,
  FootballDataRequestError,
  LA_LIGA_COMPETITION_ID,
  currentSeasonStartYear,
  getTopScorers,
  type NormalizedTopScorer,
} from '@/lib/football-data'

/**
 * GET /api/scorers
 *
 * Public endpoint for the dashboard top-scorers widget.
 *
 * Query params:
 *   - competition  Currently only `laliga` is accepted (maps to id 2014).
 *   - season       Season *start* year (defaults to the current season).
 *   - limit        Number of scorers to return (1..100, default 10).
 *
 * Cache: 1-hour TTL backed by `scorers_cache`. The cache key is
 * (competition_id, season) — we always store the maximum requested limit
 * for that key, then slice on read. In practice every dashboard caller
 * uses limit=10, so the slice is a no-op.
 *
 * Response shape: `{ scorers, cached_at, season, stale? }`.
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100
const COMPETITION_MAP: Record<string, number> = {
  laliga: LA_LIGA_COMPETITION_ID,
}
const LOG_PREFIX = '[api/scorers]'

interface CachedScorers {
  scorers: NormalizedTopScorer[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const competitionRaw = (searchParams.get('competition') ?? 'laliga').toLowerCase()
  const competitionId = COMPETITION_MAP[competitionRaw]
  if (!competitionId) {
    return errorResponse(
      `Érvénytelen competition: ${competitionRaw}. Engedélyezett: laliga`,
      400
    )
  }

  const season = parseSeason(searchParams.get('season'))
  const limit = parseLimit(searchParams.get('limit'))

  const supabase = createServiceRoleClient()

  // ---- 1. Look up cache ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('scorers_cache' as never)
    .select('data, cached_at')
    .eq('competition_id', competitionId)
    .eq('season', season)
    .maybeSingle<{ data: CachedScorers; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at)) {
    return NextResponse.json({
      scorers: cacheRow.data.scorers.slice(0, limit),
      cached_at: cacheRow.cached_at,
      season,
    })
  }

  // ---- 2. Fetch from football-data.org -------------------------------------
  // Always fetch the max limit to keep the cache useful for any caller.
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
        stale: true,
      })
    }
    return mapUpstreamError(err)
  }

  // ---- 3. Persist new cache row -------------------------------------------
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
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFresh(cachedAtIso: string): boolean {
  const cachedAt = new Date(cachedAtIso).getTime()
  if (Number.isNaN(cachedAt)) return false
  return Date.now() - cachedAt < CACHE_TTL_MS
}

function parseSeason(raw: string | null): number {
  if (!raw) return currentSeasonStartYear()
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return currentSeasonStartYear()
  }
  return parsed
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed)) return DEFAULT_LIMIT
  return Math.min(Math.max(parsed, 1), MAX_LIMIT)
}

function mapUpstreamError(err: unknown): NextResponse {
  if (err instanceof FootballDataConfigError) {
    return errorResponse(
      'A football-data.org API kulcs nincs beállítva (FOOTBALL_DATA_API_KEY)',
      503
    )
  }
  if (err instanceof FootballDataRequestError) {
    return errorResponse(
      `football-data.org nem elérhető: ${err.message}`,
      err.status === 429 ? 429 : 502
    )
  }
  return errorResponse(
    err instanceof Error ? `football-data.org hiba: ${err.message}` : 'football-data.org hiba',
    502
  )
}
