/**
 * api-football.com (api-sports.io) v3 client.
 *
 * Scope of this module:
 *   - ONLY player statistics for the FC Barcelona first team.
 *   - Used as a hybrid source: football-data.org remains the squad / standings
 *     / matches / logos provider; api-football.com is consulted only here, in
 *     the player-sync pipeline, because the football-data.org `/scorers`
 *     endpoint returns a competition-wide top-100 (defenders, keepers and low
 *     scorers fall through with all-zero stats).
 *
 * The exported `getPlayerStats(season)` aggregates La Liga (140) and
 * Champions League (2) rows for every FCB player and returns a map keyed by
 * the **normalized full name** (`firstname + ' ' + lastname`). The sync route
 * joins this map against `getSquad()` (football-data.org) on the same
 * normalized name — there is no shared player-id between the two providers.
 */

const API_FOOTBALL_BASE_URL = 'https://v3.api-football.com'
const FCB_TEAM_ID = 529
const LA_LIGA_LEAGUE_ID = 140
const CHAMPIONS_LEAGUE_LEAGUE_ID = 2
const PAGE_SIZE_HINT = 20 // documented page size; we still trust `paging.total`
const MAX_PAGES = 10 // safety cap; FCB squad fits in 2 pages

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiFootballConfigError extends Error {
  constructor(message = 'API_FOOTBALL_KEY is not configured') {
    super(message)
    this.name = 'ApiFootballConfigError'
  }
}

export class ApiFootballRequestError extends Error {
  readonly status: number | null
  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiFootballRequestError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlayerStatsPayload {
  goals: number
  assists: number
  appearances: number
  games_started: number
  minutes: number
  yellow_cards: number
  red_cards: number
}

// ---------------------------------------------------------------------------
// Raw response shapes (only the fields we read)
// ---------------------------------------------------------------------------

interface RawPlayerInfo {
  id?: number
  name?: string | null
  firstname?: string | null
  lastname?: string | null
}

interface RawStatLine {
  team?: { id?: number | null } | null
  league?: { id?: number | null; season?: number | null } | null
  games?: {
    appearences?: number | null // sic — typo is in the upstream API
    lineups?: number | null
    minutes?: number | null
  } | null
  goals?: {
    total?: number | null
    assists?: number | null
  } | null
  cards?: {
    yellow?: number | null
    red?: number | null
  } | null
}

interface RawPlayerEntry {
  player?: RawPlayerInfo | null
  statistics?: RawStatLine[] | null
}

interface RawPlayersResponse {
  response?: RawPlayerEntry[] | null
  paging?: { current?: number | null; total?: number | null } | null
  errors?: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a player name for cross-provider matching.
 *
 * football-data.org returns the squad with names like "Marc-André ter Stegen",
 * api-football.com returns `firstname` + `lastname` like "Marc-André" +
 * "ter Stegen". After lowercasing, NFD-stripping diacritics, and collapsing
 * hyphens/apostrophes/whitespace the two should align on every roster member.
 */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritical marks
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeNumber(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

function emptyStats(): PlayerStatsPayload {
  return {
    goals: 0,
    assists: 0,
    appearances: 0,
    games_started: 0,
    minutes: 0,
    yellow_cards: 0,
    red_cards: 0,
  }
}

function buildFullName(info: RawPlayerInfo | null | undefined): string | null {
  if (!info) return null
  const first = (info.firstname ?? '').trim()
  const last = (info.lastname ?? '').trim()
  const combined = [first, last].filter((p) => p.length > 0).join(' ')
  if (combined.length > 0) return combined
  const fallback = (info.name ?? '').trim()
  return fallback.length > 0 ? fallback : null
}

/**
 * Pick only La Liga and Champions League rows for FCB and accumulate them
 * into the destination payload. Other competitions (cup, friendlies, prior
 * teams) are ignored.
 */
function accumulateStatLine(
  dest: PlayerStatsPayload,
  line: RawStatLine,
  season: number
): void {
  const leagueId = line.league?.id ?? null
  const lineSeason = line.league?.season ?? null
  const teamId = line.team?.id ?? null

  // Only count rows tagged with the requested season and the FCB team. A
  // mid-season transfer would otherwise leak rows from the player's previous
  // club into our totals.
  if (lineSeason !== null && lineSeason !== season) return
  if (teamId !== null && teamId !== FCB_TEAM_ID) return

  if (leagueId !== LA_LIGA_LEAGUE_ID && leagueId !== CHAMPIONS_LEAGUE_LEAGUE_ID)
    return

  dest.goals += safeNumber(line.goals?.total)
  dest.assists += safeNumber(line.goals?.assists)
  dest.appearances += safeNumber(line.games?.appearences)
  dest.games_started += safeNumber(line.games?.lineups)
  dest.minutes += safeNumber(line.games?.minutes)
  dest.yellow_cards += safeNumber(line.cards?.yellow)
  dest.red_cards += safeNumber(line.cards?.red)
}

async function fetchPlayersPage(
  season: number,
  page: number,
  apiKey: string
): Promise<RawPlayersResponse> {
  const url = `${API_FOOTBALL_BASE_URL}/players?team=${FCB_TEAM_ID}&season=${season}&page=${page}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
  } catch (err) {
    throw new ApiFootballRequestError(
      err instanceof Error
        ? `network error contacting api-football.com: ${err.message}`
        : 'network error contacting api-football.com',
      null
    )
  }

  if (!response.ok) {
    throw new ApiFootballRequestError(
      `api-football.com returned HTTP ${response.status} for page ${page}`,
      response.status
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (err) {
    throw new ApiFootballRequestError(
      err instanceof Error
        ? `invalid JSON from api-football.com: ${err.message}`
        : 'invalid JSON from api-football.com',
      response.status
    )
  }

  // api-football reports application-level failures (bad key, quota) as
  // HTTP 200 with a non-empty `errors` field — surface those as request
  // errors so the caller can short-circuit cleanly.
  if (
    body &&
    typeof body === 'object' &&
    'errors' in body &&
    body.errors &&
    typeof body.errors === 'object' &&
    Object.keys(body.errors as Record<string, unknown>).length > 0
  ) {
    throw new ApiFootballRequestError(
      `api-football.com error: ${JSON.stringify(
        (body as { errors: unknown }).errors
      )}`,
      response.status
    )
  }

  return (body ?? {}) as RawPlayersResponse
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all FC Barcelona player statistics for `season` from api-football.com,
 * aggregate La Liga + Champions League rows, and return a map keyed by the
 * normalized full name (`firstname + ' ' + lastname`).
 *
 * The map is the join surface for the player-sync route: it walks the squad
 * returned by football-data.org and looks up each member by the same
 * normalized name. Squad members with no entry on this side fall back to
 * zeroed stats in the caller — see `route.ts`.
 *
 * Pagination: walks `page=1..paging.total` (capped at `MAX_PAGES`).
 *
 * @throws {ApiFootballConfigError} when `API_FOOTBALL_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP / application errors
 */
export async function getPlayerStats(
  season: number
): Promise<Map<string, PlayerStatsPayload>> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ApiFootballConfigError()
  }

  const result = new Map<string, PlayerStatsPayload>()

  let page = 1
  let totalPages = 1
  while (page <= totalPages && page <= MAX_PAGES) {
    const data = await fetchPlayersPage(season, page, apiKey)

    const entries = Array.isArray(data.response) ? data.response : []
    for (const entry of entries) {
      const fullName = buildFullName(entry.player)
      if (!fullName) continue
      const key = normalizePlayerName(fullName)
      if (key.length === 0) continue

      const bucket = result.get(key) ?? emptyStats()
      const lines = Array.isArray(entry.statistics) ? entry.statistics : []
      for (const line of lines) {
        accumulateStatLine(bucket, line, season)
      }
      result.set(key, bucket)
    }

    const reportedTotal = data.paging?.total
    if (typeof reportedTotal === 'number' && reportedTotal > 0) {
      totalPages = reportedTotal
    }
    void PAGE_SIZE_HINT // documented hint, not relied on for control flow

    page += 1
  }

  return result
}
