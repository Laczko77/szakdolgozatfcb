import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  FootballDataConfigError,
  FootballDataRequestError,
  LA_LIGA_COMPETITION_ID,
  currentSeasonStartYear,
  getStandings,
  type NormalizedStandingsRow,
} from '@/lib/football-data'

/**
 * GET /api/standings
 *
 * Public endpoint for the dashboard La Liga table widget.
 *
 * Query params:
 *   - competition  Currently only `laliga` is accepted (maps to id 2014).
 *   - season       Season *start* year (defaults to the current season).
 *
 * Cache strategy:
 *   - 1-hour TTL backed by `standings_cache` (Supabase).
 *   - Fresh row → return the cached payload directly (no upstream call).
 *   - Stale or missing → call football-data.org, upsert, return.
 *   - Upstream error + any cached row exists (even if stale) → return the
 *     stale row with `stale: true` so the dashboard keeps working.
 *
 * Response shape: `{ standings, cached_at, season, stale? }`.
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const COMPETITION_MAP: Record<string, number> = {
  laliga: LA_LIGA_COMPETITION_ID,
}
const LOG_PREFIX = '[api/standings]'

interface CachedStandings {
  standings: NormalizedStandingsRow[]
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

  const supabase = createServiceRoleClient()

  // ---- 1. Look up cache ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('standings_cache' as never)
    .select('data, cached_at')
    .eq('competition_id', competitionId)
    .eq('season', season)
    .maybeSingle<{ data: CachedStandings; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at)) {
    return NextResponse.json({
      standings: cacheRow.data.standings,
      cached_at: cacheRow.cached_at,
      season,
    })
  }

  // ---- 2. Fetch from football-data.org -------------------------------------
  let standings: NormalizedStandingsRow[]
  try {
    standings = await getStandings(competitionId, season)
  } catch (err) {
    // Stale-while-error: if we have ANY cached row, serve it.
    if (cacheRow) {
      console.warn(
        `${LOG_PREFIX} upstream failed, serving stale cache from ${cacheRow.cached_at}:`,
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({
        standings: cacheRow.data.standings,
        cached_at: cacheRow.cached_at,
        season,
        stale: true,
      })
    }
    return mapUpstreamError(err)
  }

  // ---- 3. Persist new cache row -------------------------------------------
  const nowIso = new Date().toISOString()
  const payload: CachedStandings = { standings }

  const { error: upsertError } = await supabase
    .from('standings_cache' as never)
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
    // Non-fatal: the user still gets fresh data, we just couldn't cache.
    console.error(`${LOG_PREFIX} cache upsert failed:`, upsertError.message)
  }

  return NextResponse.json({
    standings,
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
