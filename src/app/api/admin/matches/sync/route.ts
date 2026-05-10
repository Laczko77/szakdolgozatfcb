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
 */

const MIN_SEASON = 2000
const MAX_SEASON = 2100
const LOG_PREFIX = '[matches/sync]'
const SOFASCORE_DELAY_MS = 200

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
      errors: [],
      season,
    })
  }

  // ---- Upsert -------------------------------------------------------------
  const supabase = createServiceRoleClient()
  const errors: string[] = []
  let synced = 0
  let sectorsSeeded = 0
  let sofascoreCached = 0

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

      // ---- Sofascore cache pre-warm (finished matches only) -------------
      if (match.status === 'FT' || match.status === 'AWD') {
        try {
          const cached = await prewarmMatchCache(supabase, match, errors)
          if (cached) sofascoreCached += 1
        } catch (err) {
          // Defensive belt-and-braces: any unexpected throw during pre-warm
          // is logged as a per-match error and the sync continues. Match
          // upsert + sector seed already succeeded above.
          errors.push(
            `Meccs #${match.id} cache prewarm: ${
              err instanceof Error ? err.message : 'ismeretlen hiba'
            }`
          )
        }
      }
    } catch (err) {
      errors.push(
        `Meccs #${match.id}: ${
          err instanceof Error ? err.message : 'ismeretlen hiba'
        }`
      )
    }
  }

  const elapsedMs = Date.now() - startedAt
  console.log(
    `${LOG_PREFIX} season=${season} fetched=${matches.length} synced=${synced} ` +
      `sectorsSeeded=${sectorsSeeded} sofascoreCached=${sofascoreCached} ` +
      `errors=${errors.length} elapsedMs=${elapsedMs}`
  )

  return successResponse({
    synced,
    sectorsSeeded,
    sofascoreCached,
    errors,
    season,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cacheKeyFor = (matchId: number) => `match:${matchId}`

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch match details + Sofascore extras and persist them to
 * `match_details_cache` (and the relational `match_team_stats` snapshot).
 *
 * Returns `true` when a new cache row was written, `false` when the row was
 * already present (either someone hit the route since the last sync or a
 * prior sync already pre-warmed it). Per-endpoint failures are non-fatal —
 * they are appended to `errors` and a partial payload is still cached so
 * the user-facing route does not have to retry every Sofascore endpoint.
 */
async function prewarmMatchCache(
  supabase: ReturnType<typeof createServiceRoleClient>,
  match: NormalizedMatch,
  errors: string[]
): Promise<boolean> {
  const cacheKey = cacheKeyFor(match.id)

  // Fast path: skip if already cached. Finished-match data does not change.
  const { data: existing, error: lookupError } = await supabase
    .from('match_details_cache' as never)
    .select('cache_key')
    .eq('cache_key', cacheKey)
    .maybeSingle<{ cache_key: string }>()

  if (lookupError) {
    errors.push(
      `Meccs #${match.id} cache lookup: ${lookupError.message}`
    )
    return false
  }
  if (existing) return false

  // ---- Fetch football-data details (events + match block) --------------
  let details: MatchDetails
  try {
    details = await getMatchDetails(match.id)
  } catch (err) {
    errors.push(
      `Meccs #${match.id} details: ${
        err instanceof Error ? err.message : 'ismeretlen hiba'
      }`
    )
    return false
  }

  // ---- Fetch Sofascore data (sequential, with 200ms delay) -------------
  // Sequential is intentional: the free RapidAPI plan is 500 req/month, so
  // we serialise calls and pause between them rather than fanning out.
  let eventId: number | null = null
  let teamStats: FixtureTeamStats | null = null
  let lineups: SofascoreLineupsPayload | null = null
  let incidents: SofascoreIncident[] = []
  let shotmap: SofascoreShotmapEntry[] = []
  let graph: SofascoreGraphPoint[] = []
  let bestPlayers: SofascoreBestPlayers | null = null

  try {
    await delay(SOFASCORE_DELAY_MS)
    eventId = await findSofascoreEventId(match.utcDate)
  } catch (err) {
    logSofa(match.id, 'event-id', err, errors)
  }

  if (eventId !== null) {
    teamStats = await safeSofa(match.id, 'team-stats', errors, () =>
      getSofascoreMatchStats(eventId as number)
    )
    lineups = await safeSofa(match.id, 'lineups', errors, () =>
      getSofascoreLineups(eventId as number)
    )
    incidents = (await safeSofa(match.id, 'incidents', errors, () =>
      getSofascoreIncidents(eventId as number)
    )) ?? []
    shotmap = (await safeSofa(match.id, 'shotmap', errors, () =>
      getSofascoreShotmap(eventId as number)
    )) ?? []
    graph = (await safeSofa(match.id, 'graph', errors, () =>
      getSofascoreGraph(eventId as number)
    )) ?? []
    bestPlayers = await safeSofa(match.id, 'best-players', errors, () =>
      getSofascoreBestPlayers(eventId as number)
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
 * Run a Sofascore call after the rate-limit delay. Per-call failures are
 * non-fatal — they are reported into `errors` and the function returns
 * `null` so the caller can fall back to a default (null / `[]`).
 */
async function safeSofa<T>(
  matchId: number,
  label: string,
  errors: string[],
  fn: () => Promise<T>
): Promise<T | null> {
  await delay(SOFASCORE_DELAY_MS)
  try {
    return await fn()
  } catch (err) {
    logSofa(matchId, label, err, errors)
    return null
  }
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
