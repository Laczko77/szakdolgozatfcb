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
 *   - `getMatchDetails` (football-data.org) and `findSofascoreEventId`
 *     (Sofascore) run in parallel — they share no inputs (~1.5 s combined).
 *   - The 6 per-event Sofascore calls are issued sequentially with 150 ms
 *     inter-request pauses to stay within RapidAPI rate limits (~3 req/s).
 *     Six calls × ~500 ms avg + five pauses ≈ 3.75 s per match.
 *   - Matches are processed one at a time (MATCH_PREWARM_CONCURRENCY=1) —
 *     concurrent match processing would multiply the burst (3 × 6 = 18 req)
 *     and reliably trigger 429s, leaving caches with missing Sofascore data.
 *   - At most `MAX_PREWARM_PER_RUN` (6) matches per invocation → worst case
 *     6 × 5.5 s ≈ 33 s, well under the 60 s cap. Leftovers are picked up by
 *     the next sync run or lazy-loaded by the public route on first visit.
 */

// Tell Vercel to allow up to 60 s for this function. Without this the platform
// applies the plan default (10–15 s) which is not enough for Phase 1 (~20 s of
// sequential DB upserts) + Phase 2 Sofascore pre-warm.
export const maxDuration = 60

const MIN_SEASON = 2000
const MAX_SEASON = 2100
const LOG_PREFIX = '[matches/sync]'

/**
 * Cap on how many uncached finished matches we pre-warm in a single sync
 * invocation.
 *
 * Budget: matches are processed one at a time (MATCH_PREWARM_CONCURRENCY=1).
 * Each match costs ~1.5 s for the parallel football-data + Sofascore event-id
 * lookup, then ~3 s for the 6 sequential Sofascore endpoint calls (each with a
 * 150 ms inter-request pause). Worst case ≈ 6 × 5 s = 30 s — well under
 * Vercel's 60 s function cap. Raise only when average latency confirms it.
 */
const MAX_PREWARM_PER_RUN = 6

/**
 * Number of matches pre-warmed concurrently.
 *
 * Kept at 1 (serial) because each match already fans out to 6 Sofascore
 * endpoint calls. Running multiple matches in parallel multiplies that burst
 * (3 × 6 = 18 simultaneous requests) and reliably triggers RapidAPI 429s,
 * leaving match caches with null/empty Sofascore payloads.
 */
const MATCH_PREWARM_CONCURRENCY = 1

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

  // ---- Phase 1: upsert matches + seed sectors (parallel, bounded) -----------
  // Each match requires 2 sequential DB calls (upsert → UUID → sector batch).
  // Running them sequentially took ~20 s for a 48-match season, which — without
  // maxDuration — caused Vercel to time-out the function before a response
  // was ever sent. Running at concurrency 5 cuts Phase 1 to ~4 s while
  // staying well below Supabase's connection-pool limit.
  const supabase = createServiceRoleClient()
  const errors: string[] = []
  let synced = 0
  let sectorsSeeded = 0
  const finishedToPrewarm: NormalizedMatch[] = []

  const phase1Tasks = matches.map(
    (match) => async (): Promise<{ match: NormalizedMatch; sectorsInserted: number }> => {
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
        throw new Error(upsertError?.message ?? 'ismeretlen hiba')
      }

      // Idempotent fixed-sector seed. ignoreDuplicates means subsequent syncs
      // do NOT overwrite admin-edited prices / capacities.
      const matchRow = upserted as { id: string }
      const seedResult = await seedFixedSectorsForMatch(supabase, matchRow.id)
      if (seedResult.error) {
        throw new Error(`szektor seed: ${seedResult.error}`)
      }

      return { match, sectorsInserted: seedResult.inserted }
    }
  )

  const phase1Settled = await withConcurrency(phase1Tasks, 5)

  for (let pi = 0; pi < phase1Settled.length; pi++) {
    const outcome = phase1Settled[pi]
    const match = matches[pi]
    if (outcome.status === 'fulfilled') {
      synced += 1
      sectorsSeeded += outcome.value.sectorsInserted
      if (match.status === 'FT' || match.status === 'AWD') {
        finishedToPrewarm.push(match)
      }
    } else {
      errors.push(
        `Meccs #${match.id} (${match.homeTeam} vs ${match.awayTeam}): ${
          outcome.reason instanceof Error
            ? outcome.reason.message
            : 'ismeretlen hiba'
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
    // Sequential Sofascore calls with a small inter-request pause.
    // Firing all 6 simultaneously via Promise.allSettled triggers RapidAPI
    // 429s (burst of 6 req against a ~5 req/s free-tier ceiling). Sequential
    // execution at ~150 ms gaps keeps throughput at ≈3 req/s — well under the
    // limit — while adding only ~0.75 s of overhead per match.
    const teamStatsRes = await settle(getSofascoreMatchStats(id))
    await sofaPause()
    const lineupsRes = await settle(getSofascoreLineups(id))
    await sofaPause()
    const incidentsRes = await settle(getSofascoreIncidents(id))
    await sofaPause()
    const shotmapRes = await settle(getSofascoreShotmap(id))
    await sofaPause()
    const graphRes = await settle(getSofascoreGraph(id))
    await sofaPause()
    const bestPlayersRes = await settle(getSofascoreBestPlayers(id))

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

/**
 * Wrap a promise into a PromiseSettledResult so sequential callers can use
 * the same `unwrapSofa` extraction pattern as `Promise.allSettled` does.
 */
function settle<T>(p: Promise<T>): Promise<PromiseSettledResult<T>> {
  return p
    .then((value): PromiseSettledResult<T> => ({ status: 'fulfilled', value }))
    .catch((reason): PromiseSettledResult<T> => ({ status: 'rejected', reason }))
}

/** Inter-request pause that keeps Sofascore RapidAPI calls below ~3 req/s. */
function sofaPause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150))
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
