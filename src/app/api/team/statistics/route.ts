import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  ApiFootballConfigError,
  ApiFootballRequestError,
  SOFASCORE_TOURNAMENT_IDS,
  getSofascoreSeasonIds,
  getSofascoreTeamStatistics,
  type SofascoreTeamStatistics,
} from '@/lib/api-football'
import { buildCacheKey, isFresh } from '../../season/_shared'

/**
 * GET /api/team/statistics
 *
 * FCB szezon-szintű csapatstatisztika egyetlen sorozatra (La Liga vagy CL).
 *
 * Query params:
 *   - season       Szezon kezdő-éve (default: legutóbbi mappolt szezon)
 *   - tournamentId Sofascore tournament id (default 8 = La Liga; 7 = CL).
 *                  Aliasok is elfogadottak: `laliga`, `championsleague`/`cl`.
 *
 * Response:
 *   { statistics: SofascoreTeamStatistics, cached_at, season, tournament_id }
 *
 * Cache: 24 óra, `team_stats_cache` (JSONB). Auth: nem szükséges, publikus.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LOG_PREFIX = '[api/team/statistics]'
const DEFAULT_SEASON = 2024 // legutóbbi olyan szezon, amire van Sofascore season-id

interface CachedTeamStats {
  statistics: SofascoreTeamStatistics
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const season = parseSeason(searchParams.get('season'))
  if (season === null) {
    return errorResponse('Érvénytelen season paraméter', 400)
  }

  const tournamentId = parseTournamentId(searchParams.get('tournamentId'))
  if (tournamentId === null) {
    return errorResponse('Érvénytelen tournamentId paraméter', 400)
  }

  const seasonIds = getSofascoreSeasonIds(season)
  if (!seasonIds) {
    return errorResponse(
      `A ${season} szezon Sofascore season-id mappingje nincs definiálva`,
      400
    )
  }

  // Tournament → seasonId felbontása
  let seasonId: number | null = null
  if (tournamentId === SOFASCORE_TOURNAMENT_IDS.laLiga) {
    seasonId = seasonIds.laLiga
  } else if (tournamentId === SOFASCORE_TOURNAMENT_IDS.championsLeague) {
    seasonId = seasonIds.championsLeague
  }
  if (seasonId === null) {
    return errorResponse(
      'A megadott tournamentId nem támogatott (csak La Liga és CL)',
      400
    )
  }

  const cacheKey = buildCacheKey(['team-stats', tournamentId, season])
  const supabase = createServiceRoleClient()

  // ---- 1. Cache lookup ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('team_stats_cache' as never)
    .select('data, cached_at')
    .eq('cache_key', cacheKey)
    .maybeSingle<{ data: CachedTeamStats; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at, CACHE_TTL_MS)) {
    return NextResponse.json({
      statistics: cacheRow.data.statistics,
      cached_at: cacheRow.cached_at,
      season,
      tournament_id: tournamentId,
    })
  }

  // ---- 2. Upstream fetch --------------------------------------------------
  let statistics: SofascoreTeamStatistics | null
  try {
    statistics = await getSofascoreTeamStatistics(tournamentId, seasonId)
  } catch (err) {
    if (cacheRow) {
      console.warn(
        `${LOG_PREFIX} upstream failed, serving stale cache from ${cacheRow.cached_at}:`,
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({
        statistics: cacheRow.data.statistics,
        cached_at: cacheRow.cached_at,
        season,
        tournament_id: tournamentId,
        stale: true,
      })
    }
    return mapSofascoreError(err)
  }

  if (!statistics) {
    return errorResponse(
      'Nem érhető el csapatstatisztika a megadott szezonra',
      404
    )
  }

  // ---- 3. Persist cache ---------------------------------------------------
  const nowIso = new Date().toISOString()
  const payload: CachedTeamStats = { statistics }

  const { error: upsertError } = await supabase
    .from('team_stats_cache' as never)
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
    statistics,
    cached_at: nowIso,
    season,
    tournament_id: tournamentId,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSeason(raw: string | null): number | null {
  if (!raw) return DEFAULT_SEASON
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) return null
  return parsed
}

function parseTournamentId(raw: string | null): number | null {
  if (!raw) return SOFASCORE_TOURNAMENT_IDS.laLiga
  const lower = raw.toLowerCase()
  if (lower === 'laliga') return SOFASCORE_TOURNAMENT_IDS.laLiga
  if (lower === 'championsleague' || lower === 'cl') {
    return SOFASCORE_TOURNAMENT_IDS.championsLeague
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

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
