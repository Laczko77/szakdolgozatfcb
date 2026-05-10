import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import {
  FootballDataConfigError,
  FootballDataRequestError,
  currentSeasonStartYear,
  getMatchDetails,
  getMatches,
  type MatchDetails,
  type NormalizedMatch,
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
import { seedFixedSectorsForMatch } from '@/lib/sectors-seed'
import type { TablesInsert } from '@/types/database'

/**
 * POST /api/admin/matches/sync
 *
 * Admin-triggered job: pulls FC Barcelona matches for the current season
 * from football-data.org and upserts each one into `public.matches`.
 * Conflict resolution by `api_football_id` (UNIQUE in schema).
 *
 * For every finished match (status = `FT` or `AWD`) that does **not** yet
 * have a `match_details_cache` row, this endpoint pre-warms the cache by
 * fetching match details + Sofascore-backed extras (lineups / incidents /
 * shotmap / graph / best players / team statistics). This eliminates the
 * first-visitor cold-start latency on the season match-detail page.
 *
 * Body: `{ season?: number }`. Default = `currentSeasonStartYear()`.
 *
 * The endpoint never deletes matches — past sync runs are not authoritative
 * for the existence of a fixture (admin may have created sectors against an
 * older match that has since been removed from the response window).
 *
 * Note: the football-data.org `/teams/{id}/matches` endpoint does not
 * include venue, so `venue` is always written as null on sync.
 *
 * Pre-warm performance contract (Vercel 60s function limit):
 *   - Per-match Sofascore calls fan out via `Promise.all` (6 endpoints
 *     after `findSofascoreEventId` resolves). `getMatchDetails` runs in
 *     parallel with that chain.
 *   - Match-level pre-warm runs at concurrency `MATCH_PREWARM_CONCURRENCY`
 *     so we never have more than 3 matches × ~6 Sofascore calls = 18
 *     concurrent upstream requests in flight.
 *   - At most `MAX_PREWARM_PER_RUN` matches are warmed per invocation;
 *     leftovers are reported as `sofascoreSkipped` and picked up by the
 *     next sync run (or lazy-loaded by the public route on first visit).
 */

const MIN_SEASON = 2000
const MAX_SEASON = 2100
const LOG_PREFIX = '[matches/sync]'

/**
 * Cap on how many uncached finished matches we pre-warm in a single sync
 * invocation. Picked to keep a worst-case run (no cache hits, slow upstream)
 * comfortably under Vercel's 60s function timeout: at concurrency 3 with
 * ~2-4s per match-batch, 15 matches resolve in ~5 batches ≈ 10-20s.
 */
const MAX_PREWARM_PER_RUN = 15

/**
 * Number of matches whose Sofascore extras are pre-warmed in parallel.
 * Inside each match the 6 Sofascore endpoints are fanned out further, so
 * the effective in-flight RapidAPI request ceiling is ~18 — within the
 * comfort zone for the free plan's per-second budget.
 */
const MATCH_PREWARM_CONCURRENCY = 3

type DataQuality = 'full' | 'partial' | 'unavailable'

interface MatchEventsCachePayload {
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

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const startedAt = Date.now()

  // ---- Parse body ---------------------------------------------------------
  let season = currentSeasonStartYear()
  try {
    const text = await request.text()
    if (text.trim().length > 0) {
      const parsed: unknown = JSON.parse(text)
      if (
        parsed &&
        typeof parsed === 'object' &&
        'season' in parsed &&
        typeof (parsed as { season?: unknown }).season === 'number'
      ) {
        const candidate = (parsed as { season: number }).season
        if (
          !Number.isInteger(candidate) ||
          candidate < MIN_SEASON ||
          candidate > MAX_SEASON
        ) {
          return errorResponse('Érvénytelen szezon', 400)
        }
        season = candidate
      }
    }
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  // ---- Fetch from football-data.org --------------------------------------
  let matches: NormalizedMatch[]
  try {
    matches = await getMatches(season)
  } catch (err) {
    if (err instanceof FootballDataConfigError) {
      return errorResponse(
        'A football-data.org API kulcs nincs beállítva (FOOTBALL_DATA_API_KEY)',
        503
      )
    }
    if (err instanceof FootballDataRequestError) {
      return errorResponse(
        `football-data.org nem elérhető: ${err.message}`,
        502
      )
    }
    return errorResponse(
      err instanceof Error
        ? `football-data.org hiba: ${err.message}`
        : 'football-data.org hiba',
      502
    )
  }

  if (matches.length === 0) {
    console.log(`${LOG_PREFIX} season=${season} no matches returned`)
    return successResponse({
      synced: 0,
      sectorsSeeded: 0,
      sofascoreCached: 0,
      sofascoreSkipped: 0,
      errors: [],
      season,
    })
  }

  // ---- Phase 1: upsert matches + seed sectors (sequential) ---------------
  // This phase is sequential by design: it touches the DB only and the
  // wall-clock cost is small (one upsert + one idempotent seed per match).
  // Parallelising it would complicate error attribution without a
  // meaningful latency win.
  const supabase = createServiceRoleClient()
  const errors: string[] = []
  let synced = 0
  let sectorsSeeded = 0
  const finishedToPrewarm: NormalizedMatch[] = []

  for (const match of matches) {
    try {
      const insert: TablesInsert<'matches'> = {
        api_football_id: match.id,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        home_team_crest: match.homeTeamCrest,
        away_team_crest: match.awayTeamCrest,
        date: match.utcDate,
        venue: null,
        status: match.status,
        score: match.score,
        competition: match.competition,
      }

      // Upsert + RETURNING to get the local UUID for the sector seed below.
      const { data: upserted, error: upsertError } = await supabase
        .from('matches')
        .upsert(insert as never, {
          onConflict: 'api_football_id',
          ignoreDuplicates: false,
        })
        .select('id')
        .single()

      if (upsertError || !upserted) {
        errors.push(
          `Meccs #${match.id} (${match.homeTeam} vs ${match.awayTeam}): ${
            upsertError?.message ?? 'ismeretlen hiba'
          }`
        )
        continue
      }

      synced += 1

      // Idempotent fixed-sector seed. ignoreDuplicates means subsequent syncs
      // do NOT overwrite admin-edited prices / capacities.
      const matchRow = upserted as { id: string }
      const seedResult = await seedFixedSectorsForMatch(supabase, matchRow.id)
      if (seedResult.error) {
        errors.push(`Meccs #${match.id} szektor seed: ${seedResult.error}`)
      } else {
        sectorsSeeded += seedResult.inserted
      }

      if (match.status === 'FT' || match.status === 'AWD') {
        finishedToPrewarm.push(match)
      }
    } catch (err) {
      errors.push(
        `Meccs #${match.id}: ${
          err instanceof Error ? err.message : 'ismeretlen hiba'
        }`
      )
    }
  }

  // ---- Phase 2: Sofascore cache pre-warm (parallel, capped) --------------
  // Filter out matches that already have a cached payload before starting
  // the heavy fan-out. The cache lookup itself is cheap, so doing it inside
  // each `prewarmMatchCache` would still be correct — but pre-filtering
  // means the concurrency budget targets work that actually has to happen.
  const uncached = await filterUncachedMatches(supabase, finishedToPrewarm, errors)
  const toPrewarm = uncached.slice(0, MAX_PREWARM_PER_RUN)
  const sofascoreSkipped = Math.max(0, uncached.length - toPrewarm.length)

  let sofascoreCached = 0
  if (toPrewarm.length > 0) {
    const tasks = toPrewarm.map(
      (m) => () => prewarmMatchCache(supabase, m, errors)
    )
    const settled = await withConcurrency(tasks, MATCH_PREWARM_CONCURRENCY)
    for (let i = 0; i < settled.length; i += 1) {
      const outcome = settled[i]
      if (outcome.status === 'fulfilled') {
        if (outcome.value) sofascoreCached += 1
      } else {
        // Defensive belt-and-braces: any unexpected throw bubbles up here
        // (the prewarm helper already catches per-endpoint errors). The
        // matches table upsert + sector seed already succeeded above, so
        // we record the per-match failure and move on.
        const failed = toPrewarm[i]
        errors.push(
          `Meccs #${failed.id} cache prewarm: ${
            outcome.reason instanceof Error
              ? outcome.reason.message
              : 'ismeretlen hiba'
          }`
        )
      }
    }
  }

  const elapsedMs = Date.now() - startedAt
  console.log(
    `${LOG_PREFIX} season=${season} fetched=${matches.length} synced=${synced} ` +
      `sectorsSeeded=${sectorsSeeded} sofascoreCached=${sofascoreCached} ` +
      `sofascoreSkipped=${sofascoreSkipped} errors=${errors.length} ` +
      `elapsedMs=${elapsedMs}`
  )

  return successResponse({
    synced,
    sectorsSeeded,
    sofascoreCached,
    sofascoreSkipped,
    errors,
    season,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cacheKeyFor = (matchId: number) => `match:${matchId}`

/**
 * Run async tasks in parallel with a bounded concurrency.
 *
 * Mirrors the helper used by `getPlayerStats` in `lib/api-football.ts`:
 * each task runs once, results are kept in submission order, and a single
 * task rejection does NOT abort the rest — the caller inspects the
 * `PromiseSettledResult` to decide.
 *
 * Why bounded (vs. `Promise.all` over all matches): each match fans out to
 * ~7 upstream calls (1 football-data.org + 1 event-id resolve + 6 Sofascore).
 * 50 matches × 7 = 350 concurrent requests would breach RapidAPI rate
 * limits and saturate Node's HTTP agent. Concurrency 3 keeps the live
 * request ceiling around ~18, which the free plan tolerates comfortably.
 */
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  let idx = 0
  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const i = idx++
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() }
      } catch (e) {
        results[i] = { status: 'rejected', reason: e }
      }
    }
  }
  const workerCount = Math.max(1, Math.min(limit, tasks.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

/**
 * Bulk-filter a list of finished matches down to those WITHOUT a cached
 * payload. Uses a single `IN`-style query rather than one round-trip per
 * match so a 40-match season costs one DB call instead of 40.
 */
async function filterUncachedMatches(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matches: NormalizedMatch[],
  errors: string[]
): Promise<NormalizedMatch[]> {
  if (matches.length === 0) return []

  const cacheKeys = matches.map((m) => cacheKeyFor(m.id))
  const { data, error } = await supabase
    .from('match_details_cache' as never)
    .select('cache_key')
    .in('cache_key', cacheKeys)

  if (error) {
    errors.push(`Cache lookup: ${error.message}`)
    // Defensive fallback: when the bulk lookup fails, treat everything as
    // potentially cached so we do NOT thunder the upstream APIs. Operators
    // see the error in the response and can re-run after fixing the DB.
    return []
  }

  const cachedSet = new Set<string>(
    Array.isArray(data)
      ? (data as Array<{ cache_key: string }>).map((row) => row.cache_key)
      : []
  )
  return matches.filter((m) => !cachedSet.has(cacheKeyFor(m.id)))
}

/**
 * Fetch match details + Sofascore extras and persist them to
 * `match_details_cache` (and the relational `match_team_stats` snapshot).
 *
 * Returns `true` when a new cache row was written, `false` when the row
 * could not be persisted. The pre-filtering in `filterUncachedMatches`
 * already excludes already-cached rows, so this helper does NOT re-check.
 *
 * Concurrency model:
 *   - `getMatchDetails` (football-data.org) runs in parallel with the
 *     Sofascore event-id lookup — they are independent.
 *   - Once the event id is known, the 6 per-event Sofascore calls fan out
 *     via `Promise.allSettled`. Per-endpoint failures are non-fatal and
 *     reported into `errors`; a partial payload is still cached so the
 *     user-facing route does not have to retry every endpoint.
 */
async function prewarmMatchCache(
  supabase: ReturnType<typeof createServiceRoleClient>,
  match: NormalizedMatch,
  errors: string[]
): Promise<boolean> {
  const cacheKey = cacheKeyFor(match.id)

  // Kick off football-data details and Sofascore event-id resolution in
  // parallel — they share no inputs and the event-id lookup is the slow
  // path (paginated history walk).
  const [detailsSettled, eventIdSettled] = await Promise.allSettled([
    getMatchDetails(match.id),
    findSofascoreEventId(match.utcDate),
  ])

  if (detailsSettled.status === 'rejected') {
    errors.push(
      `Meccs #${match.id} details: ${
        detailsSettled.reason instanceof Error
          ? detailsSettled.reason.message
          : 'ismeretlen hiba'
      }`
    )
    return false
  }
  const details = detailsSettled.value

  let eventId: number | null = null
  if (eventIdSettled.status === 'fulfilled') {
    eventId = eventIdSettled.value
  } else {
    logSofa(match.id, 'event-id', eventIdSettled.reason, errors)
  }

  // ---- Fetch the 6 Sofascore endpoints in parallel ---------------------
  let teamStats: FixtureTeamStats | null = null
  let lineups: SofascoreLineupsPayload | null = null
  let incidents: SofascoreIncident[] = []
  let shotmap: SofascoreShotmapEntry[] = []
  let graph: SofascoreGraphPoint[] = []
  let bestPlayers: SofascoreBestPlayers | null = null

  if (eventId !== null) {
    const id = eventId
    const [
      teamStatsRes,
      lineupsRes,
      incidentsRes,
      shotmapRes,
      graphRes,
      bestPlayersRes,
    ] = await Promise.allSettled([
      getSofascoreMatchStats(id),
      getSofascoreLineups(id),
      getSofascoreIncidents(id),
      getSofascoreShotmap(id),
      getSofascoreGraph(id),
      getSofascoreBestPlayers(id),
    ])

    teamStats = unwrapSofa(match.id, 'team-stats', teamStatsRes, errors, null)
    lineups = unwrapSofa(match.id, 'lineups', lineupsRes, errors, null)
    incidents = unwrapSofa(match.id, 'incidents', incidentsRes, errors, []) ?? []
    shotmap = unwrapSofa(match.id, 'shotmap', shotmapRes, errors, []) ?? []
    graph = unwrapSofa(match.id, 'graph', graphRes, errors, []) ?? []
    bestPlayers = unwrapSofa(
      match.id,
      'best-players',
      bestPlayersRes,
      errors,
      null
    )
  }

  // ---- Persist relational team-stats snapshot (best-effort) ------------
  if (eventId !== null && teamStats) {
    const { error: statsUpsertError } = await supabase
      .from('match_team_stats' as never)
      .upsert(
        {
          football_data_match_id: match.id,
          apifootball_fixture_id: eventId,
          home_possession: teamStats.home.possession,
          away_possession: teamStats.away.possession,
          home_shots: teamStats.home.shots,
          away_shots: teamStats.away.shots,
          home_shots_on_target: teamStats.home.shots_on_target,
          away_shots_on_target: teamStats.away.shots_on_target,
          home_corners: teamStats.home.corners,
          away_corners: teamStats.away.corners,
          home_fouls: teamStats.home.fouls,
          away_fouls: teamStats.away.fouls,
          home_pass_accuracy: teamStats.home.pass_accuracy,
          away_pass_accuracy: teamStats.away.pass_accuracy,
        } as never,
        { onConflict: 'football_data_match_id' }
      )
    if (statsUpsertError) {
      errors.push(
        `Meccs #${match.id} match_team_stats upsert: ${statsUpsertError.message}`
      )
    }
  }

  // ---- Build the cache payload (mirrors the route's response shape) ----
  const payload: MatchEventsCachePayload = {
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
    team_stats: teamStats,
    lineups,
    incidents,
    shotmap,
    graph,
    best_players: bestPlayers,
    data_quality: deriveDataQuality(details),
  }

  const { error: cacheUpsertError } = await supabase
    .from('match_details_cache' as never)
    .upsert(
      {
        cache_key: cacheKey,
        data: payload,
        cached_at: new Date().toISOString(),
      } as never,
      { onConflict: 'cache_key' }
    )

  if (cacheUpsertError) {
    errors.push(
      `Meccs #${match.id} cache upsert: ${cacheUpsertError.message}`
    )
    return false
  }

  return true
}

/**
 * Resolve a `PromiseSettledResult` from one of the six per-match Sofascore
 * fan-out calls into a value, returning `fallback` (and logging into
 * `errors`) when the upstream rejected. Mirrors the prior `safeSofa`
 * contract but works on already-settled results.
 */
function unwrapSofa<T>(
  matchId: number,
  label: string,
  settled: PromiseSettledResult<T>,
  errors: string[],
  fallback: T
): T {
  if (settled.status === 'fulfilled') return settled.value
  logSofa(matchId, label, settled.reason, errors)
  return fallback
}

function logSofa(
  matchId: number,
  label: string,
  err: unknown,
  errors: string[]
): void {
  // Config errors are surfaced as a single explicit message — re-throwing
  // would abort the entire sync, which is undesirable: matches table upsert
  // succeeded already and the cache pre-warm is a best-effort enhancement.
  if (err instanceof ApiFootballConfigError) {
    errors.push(`Meccs #${matchId} ${label}: SOFASCORE_RAPIDAPI_KEY missing`)
    return
  }
  if (err instanceof ApiFootballRequestError) {
    errors.push(`Meccs #${matchId} ${label}: ${err.message}`)
    return
  }
  errors.push(
    `Meccs #${matchId} ${label}: ${
      err instanceof Error ? err.message : 'ismeretlen hiba'
    }`
  )
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
