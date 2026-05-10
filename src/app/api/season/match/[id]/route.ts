import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  FootballDataConfigError,
  FootballDataRequestError,
  getMatchDetails,
  type MatchDetails,
} from '@/lib/football-data'
import {
  ApiFootballConfigError,
  ApiFootballRequestError,
  findSofascoreEventId,
  getSofascoreBestPlayers,
  getSofascoreGraph,
  getSofascoreIncidents,
  getSofascoreLineups,
  getSofascoreMatchStats,
  getSofascoreShotmap,
  type FixtureTeamStats,
  type SofascoreBestPlayers,
  type SofascoreGraphPoint,
  type SofascoreIncident,
  type SofascoreLineupsPayload,
  type SofascoreShotmapEntry,
} from '@/lib/api-football'
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
  team_stats: FixtureTeamStats | null
  lineups: SofascoreLineupsPayload | null
  incidents: SofascoreIncident[]
  shotmap: SofascoreShotmapEntry[]
  graph: SofascoreGraphPoint[]
  best_players: SofascoreBestPlayers | null
  data_quality: DataQuality
}

interface MatchTeamStatsRow {
  apifootball_fixture_id: number | null
  home_possession: number | null
  away_possession: number | null
  home_shots: number | null
  away_shots: number | null
  home_shots_on_target: number | null
  away_shots_on_target: number | null
  home_corners: number | null
  away_corners: number | null
  home_fouls: number | null
  away_fouls: number | null
  home_pass_accuracy: number | null
  away_pass_accuracy: number | null
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
    team_stats: null,
    lineups: null,
    incidents: [],
    shotmap: [],
    graph: [],
    best_players: null,
    data_quality: deriveDataQuality(details),
  }

  // ---- 3a. Sofascore-backed match data (only for finished matches) ------
  // Source: Sofascore (via RapidAPI). Lejátszott meccsek statisztikái nem
  // változnak — a JSONB cache permanensen tárolja őket; a relációs
  // `match_team_stats` tábla továbbra is csak a numerikus team-snapshotot
  // őrzi (visszafelé kompatibilitás miatt).
  if (details.status === 'FT' || details.status === 'AWD') {
    const sofascore = await resolveSofascoreData(supabase, matchId, details.utcDate)
    payload.team_stats = sofascore.team_stats
    payload.lineups = sofascore.lineups
    payload.incidents = sofascore.incidents
    payload.shotmap = sofascore.shotmap
    payload.graph = sofascore.graph
    payload.best_players = sofascore.best_players
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
interface SofascoreMatchBundle {
  team_stats: FixtureTeamStats | null
  lineups: SofascoreLineupsPayload | null
  incidents: SofascoreIncident[]
  shotmap: SofascoreShotmapEntry[]
  graph: SofascoreGraphPoint[]
  best_players: SofascoreBestPlayers | null
}

const EMPTY_BUNDLE: SofascoreMatchBundle = {
  team_stats: null,
  lineups: null,
  incidents: [],
  shotmap: [],
  graph: [],
  best_players: null,
}

/**
 * Resolve every Sofascore-sourced piece of match data for a finished match.
 *
 * Order of operations:
 *   1. If `match_team_stats` already has a row, reuse the persisted team
 *      snapshot AND fetch the auxiliary endpoints (lineups / incidents /
 *      shotmap / graph / best_players) once — they are not persisted to a
 *      relational table; the JSONB cache row at `match_details_cache` is
 *      authoritative for them. We still need the eventId to fetch them, so
 *      we resolve it once.
 *   2. Otherwise resolve the eventId once, fan out 5 fetches in parallel
 *      with `Promise.all`, then persist the team-stats snapshot to the
 *      relational table for backward compatibility.
 *
 * Any non-fatal Sofascore failure logs a warning and returns the empty
 * bundle (or partial — if the team-stats row exists but the auxiliary fetch
 * fails, we keep the team-stats portion).
 */
async function resolveSofascoreData(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchId: number,
  utcDate: string
): Promise<SofascoreMatchBundle> {
  // 1. Check the persisted relational team-stats row first
  const { data: existingStats, error: lookupError } = await supabase
    .from('match_team_stats' as never)
    .select(
      'apifootball_fixture_id, home_possession, away_possession, ' +
        'home_shots, away_shots, home_shots_on_target, away_shots_on_target, ' +
        'home_corners, away_corners, home_fouls, away_fouls, ' +
        'home_pass_accuracy, away_pass_accuracy'
    )
    .eq('football_data_match_id', matchId)
    .maybeSingle<MatchTeamStatsRow>()

  if (lookupError) {
    console.warn(
      `${LOG_PREFIX} match_team_stats lookup failed for match=${matchId}:`,
      lookupError.message
    )
  }

  try {
    // Reuse the persisted Sofascore eventId when available — saves the
    // expensive `findSofascoreEventId` pagination.
    let eventId: number | null = existingStats?.apifootball_fixture_id ?? null
    if (eventId === null) {
      eventId = await findSofascoreEventId(utcDate)
    }
    if (!eventId) {
      console.log(
        `${LOG_PREFIX} no Sofascore event for match=${matchId} on ${utcDate.slice(0, 10)}`
      )
      return existingStats
        ? { ...EMPTY_BUNDLE, team_stats: rowToFixtureStats(existingStats) }
        : EMPTY_BUNDLE
    }

    // Parallel fetch — every call wraps a single upstream HTTP request.
    // `getSofascoreMatchStats` is skipped when we already have the row.
    const [statsRes, lineupsRes, incidentsRes, shotmapRes, graphRes, bestRes] =
      await Promise.all([
        existingStats
          ? Promise.resolve(rowToFixtureStats(existingStats))
          : getSofascoreMatchStats(eventId).catch((err) => {
              warnSofascore(matchId, 'team-stats', err)
              return null
            }),
        getSofascoreLineups(eventId).catch((err) => {
          warnSofascore(matchId, 'lineups', err)
          return null
        }),
        getSofascoreIncidents(eventId).catch((err) => {
          warnSofascore(matchId, 'incidents', err)
          return [] as SofascoreIncident[]
        }),
        getSofascoreShotmap(eventId).catch((err) => {
          warnSofascore(matchId, 'shotmap', err)
          return [] as SofascoreShotmapEntry[]
        }),
        getSofascoreGraph(eventId).catch((err) => {
          warnSofascore(matchId, 'graph', err)
          return [] as SofascoreGraphPoint[]
        }),
        getSofascoreBestPlayers(eventId).catch((err) => {
          warnSofascore(matchId, 'best-players', err)
          return null
        }),
      ])

    // Persist team_stats to the relational table (only if it wasn't already
    // there and we actually got a snapshot back).
    if (!existingStats && statsRes) {
      const { error: upsertError } = await supabase
        .from('match_team_stats' as never)
        .upsert(
          {
            football_data_match_id: matchId,
            apifootball_fixture_id: eventId,
            home_possession: statsRes.home.possession,
            away_possession: statsRes.away.possession,
            home_shots: statsRes.home.shots,
            away_shots: statsRes.away.shots,
            home_shots_on_target: statsRes.home.shots_on_target,
            away_shots_on_target: statsRes.away.shots_on_target,
            home_corners: statsRes.home.corners,
            away_corners: statsRes.away.corners,
            home_fouls: statsRes.home.fouls,
            away_fouls: statsRes.away.fouls,
            home_pass_accuracy: statsRes.home.pass_accuracy,
            away_pass_accuracy: statsRes.away.pass_accuracy,
          } as never,
          { onConflict: 'football_data_match_id' }
        )
      if (upsertError) {
        console.warn(
          `${LOG_PREFIX} match_team_stats upsert failed for match=${matchId}:`,
          upsertError.message
        )
      }
    }

    return {
      team_stats: statsRes,
      lineups: lineupsRes,
      incidents: incidentsRes,
      shotmap: shotmapRes,
      graph: graphRes,
      best_players: bestRes,
    }
  } catch (err) {
    if (
      err instanceof ApiFootballConfigError ||
      err instanceof ApiFootballRequestError
    ) {
      console.warn(
        `${LOG_PREFIX} Sofascore data fetch failed for match=${matchId}:`,
        err.message
      )
    } else {
      console.warn(
        `${LOG_PREFIX} unexpected Sofascore error for match=${matchId}:`,
        err instanceof Error ? err.message : err
      )
    }
    return existingStats
      ? { ...EMPTY_BUNDLE, team_stats: rowToFixtureStats(existingStats) }
      : EMPTY_BUNDLE
  }
}

function warnSofascore(matchId: number, label: string, err: unknown): void {
  console.warn(
    `${LOG_PREFIX} Sofascore ${label} failed for match=${matchId}:`,
    err instanceof Error ? err.message : err
  )
}

function rowToFixtureStats(row: MatchTeamStatsRow): FixtureTeamStats {
  return {
    home: {
      possession: row.home_possession,
      shots: row.home_shots,
      shots_on_target: row.home_shots_on_target,
      corners: row.home_corners,
      fouls: row.home_fouls,
      pass_accuracy: row.home_pass_accuracy,
    },
    away: {
      possession: row.away_possession,
      shots: row.away_shots,
      shots_on_target: row.away_shots_on_target,
      corners: row.away_corners,
      fouls: row.away_fouls,
      pass_accuracy: row.away_pass_accuracy,
    },
  }
}

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
