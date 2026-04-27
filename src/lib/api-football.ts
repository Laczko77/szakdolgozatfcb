import { API_FOOTBALL_BASE, FCB_TEAM_ID } from '@/lib/constants'

/**
 * API-Football (api-sports.io) client.
 *
 * Direct integration with the api-sports.io endpoint (NOT the RapidAPI proxy).
 * Auth header: `x-apisports-key`. Free tier: 100 requests / day — every request
 * is logged to stdout so we can audit consumption from server logs.
 *
 * NEVER call these helpers from a Client Component: the API key is server-only
 * (`process.env.API_FOOTBALL_KEY`) and must not be shipped to the browser.
 */

// ---------------------------------------------------------------------------
// Public types — narrowed subset of the API-Football response.
// We only declare the fields we actually consume; the rest is preserved
// implicitly via the JSON pass-through but not type-checked.
// ---------------------------------------------------------------------------

export interface ApiFootballResponse<T> {
  /** Empty `[]` on success; otherwise contains `{ token, requests, ... }`. */
  errors: Record<string, string> | string[]
  results: number
  response: T[]
}

export interface PlayerApiPlayer {
  id: number
  name: string
  firstname: string | null
  lastname: string | null
  age: number | null
  nationality: string | null
  height: string | null
  weight: string | null
  photo: string | null
}

export interface PlayerApiTeam {
  id: number
  name: string
  logo: string | null
}

export interface PlayerApiGames {
  appearences: number | null
  lineups: number | null
  minutes: number | null
  position: string | null
  rating: string | null
  captain: boolean | null
  number: number | null
}

export interface PlayerApiGoals {
  total: number | null
  conceded: number | null
  assists: number | null
  saves: number | null
}

export interface PlayerApiCards {
  yellow: number | null
  yellowred: number | null
  red: number | null
}

export interface PlayerApiStatistics {
  team: PlayerApiTeam
  games: PlayerApiGames
  goals: PlayerApiGoals
  cards: PlayerApiCards
}

export interface PlayerApiResponse {
  player: PlayerApiPlayer
  statistics: PlayerApiStatistics[]
}

// ----------------------------------------------------------------------------
// Fixture types — narrowed subset of the API-Football /fixtures response.
// ----------------------------------------------------------------------------

export interface FixtureApiVenue {
  id: number | null
  name: string | null
  city: string | null
}

export interface FixtureApiStatus {
  long: string | null
  short: string | null
  elapsed: number | null
}

export interface FixtureApiCore {
  id: number
  date: string // ISO 8601
  timezone: string | null
  timestamp: number | null
  venue: FixtureApiVenue
  status: FixtureApiStatus
}

export interface FixtureApiTeam {
  id: number
  name: string
  logo: string | null
  winner: boolean | null
}

export interface FixtureApiTeams {
  home: FixtureApiTeam
  away: FixtureApiTeam
}

export interface FixtureApiResponse {
  fixture: FixtureApiCore
  league: { id: number; name: string; season: number } & Record<string, unknown>
  teams: FixtureApiTeams
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiFootballConfigError extends Error {
  constructor() {
    super('API_FOOTBALL_KEY environment variable is not set')
    this.name = 'ApiFootballConfigError'
  }
}

export class ApiFootballRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiFootballRequestError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Internal: low-level fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<ApiFootballResponse<T>> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new ApiFootballConfigError()
  }

  const url = new URL(`${API_FOOTBALL_BASE}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  // Log every outbound request — free tier has a hard 100/day cap.
  // Format chosen so it greps cleanly: "[api-football] GET /players?team=529&season=2024".
  const queryString = url.searchParams.toString()
  console.log(`[api-football] GET ${endpoint}?${queryString}`)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
      Accept: 'application/json',
    },
    // Disable Next's Data Cache: this is admin-triggered work, we always want fresh.
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new ApiFootballRequestError(
      `API-Football request failed: ${response.status} ${response.statusText}`,
      response.status
    )
  }

  const data = (await response.json()) as ApiFootballResponse<T>

  // The API returns 200 even on auth/quota failures, with errors in the body.
  // Treat any non-empty `errors` payload as a hard failure.
  const errors = data.errors
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors && Object.keys(errors).length > 0
  if (hasErrors) {
    const message =
      typeof errors === 'object' && !Array.isArray(errors)
        ? Object.entries(errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ')
        : (errors as string[]).join('; ')
    throw new ApiFootballRequestError(
      `API-Football returned errors: ${message}`,
      502
    )
  }

  return data
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the FC Barcelona squad for a given season.
 *
 * The /players endpoint is paginated (50 results per page). For a club squad
 * one page is plenty, but we walk pages defensively in case API-Football
 * adjusts the page size or returns staff alongside players.
 */
export async function fetchBarcaPlayers(
  season: number
): Promise<PlayerApiResponse[]> {
  const all: PlayerApiResponse[] = []
  let page = 1
  const MAX_PAGES = 5 // hard guard against runaway loops

  while (page <= MAX_PAGES) {
    const data = await apiFetch<PlayerApiResponse>('/players', {
      team: FCB_TEAM_ID,
      season,
      page,
    })

    all.push(...data.response)

    // Pagination terminator: API-Football puts the page info on `paging` but
    // only when present. Easier to inspect: if we got fewer than the apparent
    // page size (results=50), we're done.
    if (data.response.length < 20 || data.results < 20) break
    page += 1
  }

  return all
}

/**
 * Fetch detailed statistics for a single player (across all competitions
 * for the given season). Returns the first response item or null.
 */
export async function fetchPlayerStats(
  playerId: number,
  season: number
): Promise<PlayerApiResponse | null> {
  const data = await apiFetch<PlayerApiResponse>('/players', {
    id: playerId,
    season,
  })
  return data.response[0] ?? null
}

/**
 * Fetch FC Barcelona fixtures.
 *
 * Two modes:
 *   - `next`: pull the next N upcoming fixtures (cheapest call, single page).
 *   - `season`: pull the entire season schedule.
 *
 * If both are passed, `next` wins. The /fixtures endpoint accepts either, but
 * not on the same call; we keep the helper minimal and let the caller pick.
 */
export async function fetchBarcaFixtures(opts: {
  next?: number
  season?: number
}): Promise<FixtureApiResponse[]> {
  // The free API plan only provides access to seasons 2022–2024.
  // Hard-coded default: 2024 (last available season on the free tier).
  const DEFAULT_SEASON = 2024

  const params: Record<string, string | number> = { team: FCB_TEAM_ID }
  if (typeof opts.season === 'number') {
    params.season = opts.season
  } else {
    // Default: fetch the full season schedule for the last available free-tier
    // season (2024–25). Date-range filters are intentionally omitted — combining
    // `season=2024` with `from`/`to` set to a date after the season ended
    // returns 0 results. Without date filters the API returns every fixture for
    // the season (past + future), which is what the sync job needs.
    params.season = DEFAULT_SEASON
  }

  const data = await apiFetch<FixtureApiResponse>('/fixtures', params)
  return data.response
}
