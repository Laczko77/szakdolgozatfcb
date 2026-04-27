/**
 * football-data.org v4 API client.
 *
 * Replacement for the previous api-sports.io ("API-Football") integration.
 * Auth header: `X-Auth-Token` with `process.env.FOOTBALL_DATA_API_KEY`.
 *
 * Free tier limits: 10 requests/minute, ~12 calls/minute observed in practice.
 * Each admin sync run does at most ~4 calls (squad + matches + 2x scorers),
 * so we do not implement client-side rate limiting — a 429 response is
 * surfaced to the caller as a typed error.
 *
 * NEVER call from a Client Component: the API key is server-only.
 */

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

export const BASE_URL = 'https://api.football-data.org/v4'

/** FC Barcelona team ID in the football-data.org dataset. */
export const FCB_TEAM_ID = 81

/** competition.id for the Spanish Primera División (La Liga). */
export const LA_LIGA_COMPETITION_ID = 2014

/** competition.id for the UEFA Champions League. */
export const CHAMPIONS_LEAGUE_COMPETITION_ID = 2001

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class FootballDataConfigError extends Error {
  constructor() {
    super('FOOTBALL_DATA_API_KEY environment variable is not set')
    this.name = 'FootballDataConfigError'
  }
}

export class FootballDataRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'FootballDataRequestError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Public types — narrowed subsets of the football-data.org responses.
// ---------------------------------------------------------------------------

/** Mapped/normalized squad player as returned by `getSquad()`. */
export interface SquadPlayer {
  id: number
  name: string
  /** Already mapped to our canonical labels (Goalkeeper / Defender / Midfielder / Attacker). */
  position: NormalizedPosition | null
  shirtNumber: number | null
  dateOfBirth: string | null
  nationality: string | null
}

/** Canonical position strings used across the application. */
export type NormalizedPosition =
  | 'Goalkeeper'
  | 'Defender'
  | 'Midfielder'
  | 'Attacker'

/** Mapped/normalized match as returned by `getMatches()`. */
export interface NormalizedMatch {
  id: number
  utcDate: string
  /** Normalized status (NS / FT / LIVE / PP / CANC / SUSP / AWD). */
  status: NormalizedMatchStatus
  homeTeam: string
  awayTeam: string
  homeTeamCrest: string | null
  awayTeamCrest: string | null
  /** Full-time score string ("2-1") or null when match has not finished. */
  score: string | null
  competition: string
}

export type NormalizedMatchStatus =
  | 'NS'
  | 'FT'
  | 'LIVE'
  | 'PP'
  | 'CANC'
  | 'SUSP'
  | 'AWD'

/** Mapped/normalized scorer as returned by `getScorers()`. */
export interface NormalizedScorer {
  playerId: number
  playerName: string
  goals: number
  assists: number
  playedMatches: number
}

// ---------------------------------------------------------------------------
// Raw API response shapes — only the fields we consume.
// ---------------------------------------------------------------------------

interface RawTeamResponse {
  id: number
  name: string
  squad: RawSquadMember[]
}

interface RawSquadMember {
  id: number
  name: string
  position: string | null
  shirtNumber?: number | null
  dateOfBirth?: string | null
  nationality?: string | null
}

interface RawTeamMatchesResponse {
  matches: RawMatch[]
}

interface RawMatch {
  id: number
  utcDate: string
  status: string
  competition: { id: number; name: string }
  homeTeam: { id: number; name: string; crest: string | null }
  awayTeam: { id: number; name: string; crest: string | null }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
}

interface RawScorersResponse {
  scorers: RawScorer[]
}

interface RawScorer {
  player: { id: number; name: string }
  goals: number | null
  assists: number | null
  playedMatches: number | null
}

// ---------------------------------------------------------------------------
// Internal: low-level fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    throw new FootballDataConfigError()
  }

  const url = `${BASE_URL}${path}`
  console.log(`[football-data] GET ${path}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FootballDataRequestError(
        'football-data.org kérés időtúllépés (30s)',
        504
      )
    }
    throw new FootballDataRequestError(
      err instanceof Error ? err.message : 'Network error',
      502
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new FootballDataRequestError(
        'football-data.org rate limit átlépve (10 kérés/perc)',
        429
      )
    }
    if (response.status === 403) {
      throw new FootballDataRequestError(
        'football-data.org API kulcs érvénytelen vagy nincs jogosultság',
        403
      )
    }
    throw new FootballDataRequestError(
      `football-data.org kérés sikertelen: ${response.status} ${response.statusText}`,
      response.status
    )
  }

  return (await response.json()) as T
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the FC Barcelona squad. Returns mapped players with normalized
 * positions; staff entries (those with no parseable position) are dropped.
 */
export async function getSquad(): Promise<SquadPlayer[]> {
  const data = await apiFetch<RawTeamResponse>(`/teams/${FCB_TEAM_ID}`)
  if (!Array.isArray(data.squad)) return []

  return data.squad.map((m) => ({
    id: m.id,
    name: m.name,
    position: normalizePosition(m.position),
    shirtNumber: m.shirtNumber ?? null,
    dateOfBirth: m.dateOfBirth ?? null,
    nationality: m.nationality ?? null,
  }))
}

/**
 * Fetch FC Barcelona matches for a given season.
 *
 * @param season  Season *start* year (2025 == 2025/26 season).
 *
 * Note: the `/teams/{id}/matches` endpoint never returns venue, so the
 * returned objects intentionally omit it.
 */
export async function getMatches(season: number): Promise<NormalizedMatch[]> {
  const data = await apiFetch<RawTeamMatchesResponse>(
    `/teams/${FCB_TEAM_ID}/matches?season=${season}`
  )
  if (!Array.isArray(data.matches)) return []

  return data.matches.map((m) => ({
    id: m.id,
    utcDate: m.utcDate,
    status: normalizeMatchStatus(m.status),
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    homeTeamCrest: m.homeTeam.crest ?? null,
    awayTeamCrest: m.awayTeam.crest ?? null,
    score: formatScore(m.score?.fullTime?.home, m.score?.fullTime?.away),
    competition: m.competition?.name ?? '',
  }))
}

/**
 * Fetch the top scorers for a competition + season. Returns the entire
 * list (limit=100) — the caller is expected to filter to the FCB squad
 * by player ID, since this endpoint covers the whole competition.
 */
export async function getScorers(
  competitionId: number,
  season: number
): Promise<NormalizedScorer[]> {
  const data = await apiFetch<RawScorersResponse>(
    `/competitions/${competitionId}/scorers?season=${season}&limit=100`
  )
  if (!Array.isArray(data.scorers)) return []

  return data.scorers.map((s) => ({
    playerId: s.player.id,
    playerName: s.player.name,
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    playedMatches: s.playedMatches ?? 0,
  }))
}

/**
 * Determine the season *start* year based on today's calendar date.
 *
 * UEFA football seasons run August → May, so anything from August onward
 * belongs to a season starting in the current calendar year. Earlier in
 * the year we are still in the previous season.
 */
export function currentSeasonStartYear(now: Date = new Date()): number {
  const year = now.getUTCFullYear()
  // getUTCMonth(): 0 = January, 7 = August.
  return now.getUTCMonth() >= 7 ? year : year - 1
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function normalizePosition(raw: string | null): NormalizedPosition | null {
  if (!raw) return null
  switch (raw) {
    case 'Goalkeeper':
      return 'Goalkeeper'
    case 'Defence':
      return 'Defender'
    case 'Midfield':
      return 'Midfielder'
    case 'Offence':
      return 'Attacker'
  }
  const lower = raw.toLowerCase()
  if (lower.includes('keeper')) return 'Goalkeeper'
  if (lower.includes('back') || lower.includes('defence') || lower.includes('defender'))
    return 'Defender'
  if (lower.includes('midfield')) return 'Midfielder'
  if (
    lower.includes('forward') ||
    lower.includes('winger') ||
    lower.includes('striker') ||
    lower.includes('offence') ||
    lower.includes('attack')
  )
    return 'Attacker'
  return null
}

function normalizeMatchStatus(raw: string): NormalizedMatchStatus {
  switch (raw) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'NS'
    case 'FINISHED':
      return 'FT'
    case 'LIVE':
    case 'IN_PLAY':
    case 'PAUSED':
      return 'LIVE'
    case 'POSTPONED':
      return 'PP'
    case 'CANCELLED':
      return 'CANC'
    case 'SUSPENDED':
      return 'SUSP'
    case 'AWARDED':
      return 'AWD'
    default:
      // Unknown future statuses: treat as not-started so the row is
      // still surfaced and the admin can review it manually.
      return 'NS'
  }
}

function formatScore(
  home: number | null | undefined,
  away: number | null | undefined
): string | null {
  if (typeof home !== 'number' || typeof away !== 'number') return null
  return `${home}-${away}`
}
