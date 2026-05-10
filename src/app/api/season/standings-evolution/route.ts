import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  getCompetitionMatches,
  type NormalizedCompetitionMatch,
} from '@/lib/football-data'
import {
  buildCacheKey,
  isFresh,
  mapUpstreamError,
  parseCompetition,
  parseSeason,
} from '../_shared'

/**
 * GET /api/season/standings-evolution
 *
 * Round-by-round cumulative La Liga table for a season. For every matchday
 * present in the upstream fixture list we emit a snapshot of every team's
 * points / goal-difference / position *as of that round*.
 *
 * Query params:
 *   - competition  alias `laliga` or numeric ID (default 2014)
 *   - season       Season *start* year (defaults to the current season).
 *
 * Cache: 12-hour TTL backed by `season_evolution_cache`.
 *
 * Response shape:
 *   {
 *     evolution: [
 *       { matchday: 1, teams: [{ team_id, team_name, points,
 *                                goal_difference, position }, ...] },
 *       ...
 *     ],
 *     cached_at, season, competition_id, stale?
 *   }
 */

const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours
const LOG_PREFIX = '[api/season/standings-evolution]'

interface MatchdaySnapshotTeam {
  team_id: number
  team_name: string
  points: number
  goal_difference: number
  position: number
}

interface MatchdaySnapshot {
  matchday: number
  teams: MatchdaySnapshotTeam[]
}

interface CachedEvolution {
  evolution: MatchdaySnapshot[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const competitionId = parseCompetition(searchParams.get('competition'))
  if (competitionId === null) {
    return errorResponse('Érvénytelen competition paraméter', 400)
  }
  const season = parseSeason(searchParams.get('season'))
  const cacheKey = buildCacheKey(['evolution', competitionId, season])

  const supabase = createServiceRoleClient()

  // ---- 1. Cache lookup ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('season_evolution_cache' as never)
    .select('data, cached_at')
    .eq('cache_key', cacheKey)
    .maybeSingle<{ data: CachedEvolution; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at, CACHE_TTL_MS)) {
    return NextResponse.json({
      evolution: cacheRow.data.evolution,
      cached_at: cacheRow.cached_at,
      season,
      competition_id: competitionId,
    })
  }

  console.log(
    `${LOG_PREFIX} cache miss for key=${cacheKey}, fetching upstream`
  )

  // ---- 2. Fetch upstream --------------------------------------------------
  let matches: NormalizedCompetitionMatch[]
  try {
    matches = await getCompetitionMatches(competitionId, season)
  } catch (err) {
    if (cacheRow) {
      console.warn(
        `${LOG_PREFIX} upstream failed, serving stale cache from ${cacheRow.cached_at}:`,
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({
        evolution: cacheRow.data.evolution,
        cached_at: cacheRow.cached_at,
        season,
        competition_id: competitionId,
        stale: true,
      })
    }
    return mapUpstreamError(err)
  }

  // ---- 3. Aggregate -------------------------------------------------------
  const evolution = aggregateEvolution(matches)

  // ---- 4. Persist new cache row ------------------------------------------
  const nowIso = new Date().toISOString()
  const payload: CachedEvolution = { evolution }

  const { error: upsertError } = await supabase
    .from('season_evolution_cache' as never)
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
    evolution,
    cached_at: nowIso,
    season,
    competition_id: competitionId,
  })
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface RunningTeamState {
  team_id: number
  team_name: string
  points: number
  goal_difference: number
}

/**
 * Build per-matchday snapshots from a flat fixture list.
 *
 * Algorithm
 * ---------
 * 1. Filter to FINISHED matches that have a numeric `matchday` and full-time
 *    score — the only ones that can contribute to a cumulative table.
 * 2. Sort by matchday ascending.
 * 3. Walk the list grouped by matchday: apply each result to a running
 *    `Map<team_id, RunningTeamState>`, then on each matchday boundary emit
 *    a sorted snapshot (points DESC → goal_difference DESC → team_name ASC).
 */
function aggregateEvolution(
  matches: NormalizedCompetitionMatch[]
): MatchdaySnapshot[] {
  const finished = matches
    .filter(
      (m) =>
        m.status === 'FT' &&
        typeof m.matchday === 'number' &&
        m.score.home !== null &&
        m.score.away !== null
    )
    .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0))

  if (finished.length === 0) return []

  const standings = new Map<number, RunningTeamState>()
  const snapshots: MatchdaySnapshot[] = []
  let currentMatchday = finished[0].matchday as number
  let buffer: NormalizedCompetitionMatch[] = []

  const flushMatchday = (md: number) => {
    for (const m of buffer) {
      applyResult(standings, m)
    }
    snapshots.push({
      matchday: md,
      teams: snapshotTeams(standings),
    })
    buffer = []
  }

  for (const m of finished) {
    const md = m.matchday as number
    if (md !== currentMatchday) {
      flushMatchday(currentMatchday)
      currentMatchday = md
    }
    buffer.push(m)
  }
  flushMatchday(currentMatchday)

  return snapshots
}

function applyResult(
  standings: Map<number, RunningTeamState>,
  m: NormalizedCompetitionMatch
): void {
  const home = ensureTeam(standings, m.homeTeam.id, m.homeTeam.name)
  const away = ensureTeam(standings, m.awayTeam.id, m.awayTeam.name)

  const hs = m.score.home as number
  const as = m.score.away as number

  home.goal_difference += hs - as
  away.goal_difference += as - hs

  if (hs > as) {
    home.points += 3
  } else if (hs < as) {
    away.points += 3
  } else {
    home.points += 1
    away.points += 1
  }
}

function ensureTeam(
  standings: Map<number, RunningTeamState>,
  id: number,
  name: string
): RunningTeamState {
  const existing = standings.get(id)
  if (existing) {
    // Refresh name in case the upstream feed changed casing/diacritics.
    existing.team_name = name
    return existing
  }
  const fresh: RunningTeamState = {
    team_id: id,
    team_name: name,
    points: 0,
    goal_difference: 0,
  }
  standings.set(id, fresh)
  return fresh
}

function snapshotTeams(
  standings: Map<number, RunningTeamState>
): MatchdaySnapshotTeam[] {
  const ranked = Array.from(standings.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) {
      return b.goal_difference - a.goal_difference
    }
    return a.team_name.localeCompare(b.team_name)
  })

  return ranked.map((t, idx) => ({
    team_id: t.team_id,
    team_name: t.team_name,
    points: t.points,
    goal_difference: t.goal_difference,
    position: idx + 1,
  }))
}
