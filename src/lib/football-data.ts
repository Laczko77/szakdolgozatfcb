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

/** Mapped/normalized standings row as returned by `getStandings()`. */
export interface NormalizedStandingsRow {
  position: number
  team: {
    id: number
    name: string
    crest: string | null
  }
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

/** Mapped/normalized top-scorer row as returned by `getTopScorers()`. */
export interface NormalizedTopScorer {
  player: {
    id: number
    name: string
  }
  team: {
    name: string
    crest: string | null
  }
  goals: number
  assists: number
  playedMatches: number
}

/**
 * Mapped competition-wide match row as returned by `getCompetitionMatches()`.
 *
 * Unlike `NormalizedMatch` (FCB-only, presentation-oriented), this carries
 * the team IDs so the caller can aggregate cumulative points per team and
 * know `matchday` for round-by-round buckets.
 */
export interface NormalizedCompetitionMatch {
  id: number
  matchday: number | null
  utcDate: string
  status: NormalizedMatchStatus
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  score: { home: number | null; away: number | null }
}

/** A scoring event as seen on the match-details endpoint. */
export interface MatchGoalEvent {
  minute: number | null
  scorer: { id: number | null; name: string | null }
  type: string | null
}

/** A booking (yellow / red card) event. */
export interface MatchBookingEvent {
  minute: number | null
  player: { id: number | null; name: string | null }
  card: string | null
}

/** A substitution event. */
export interface MatchSubstitutionEvent {
  minute: number | null
  playerOut: { id: number | null; name: string | null }
  playerIn: { id: number | null; name: string | null }
}

/**
 * Result of `getMatchDetails()`. All event arrays are guaranteed to be
 * present (possibly empty) so callers can render without null checks.
 *
 * `partial` is true when at least one of the event categories is missing
 * from the upstream response (a common case on the football-data.org free
 * tier).
 */
export interface MatchDetails {
  id: number
  utcDate: string
  status: NormalizedMatchStatus
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  score: { home: number | null; away: number | null }
  goals: MatchGoalEvent[]
  bookings: MatchBookingEvent[]
  substitutions: MatchSubstitutionEvent[]
  /** True iff goals/bookings/substitutions were missing or empty in upstream. */
  partial: boolean
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

interface RawCompetitionMatchesResponse {
  matches: RawCompetitionMatch[]
}

interface RawCompetitionMatch {
  id: number
  matchday: number | null
  utcDate: string
  status: string
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
}

interface RawMatchDetailsResponse {
  id: number
  utcDate: string
  status: string
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
  goals?: RawMatchGoal[] | null
  bookings?: RawMatchBooking[] | null
  substitutions?: RawMatchSubstitution[] | null
}

interface RawMatchGoal {
  minute?: number | null
  type?: string | null
  scorer?: { id?: number | null; name?: string | null } | null
}

interface RawMatchBooking {
  minute?: number | null
  card?: string | null
  player?: { id?: number | null; name?: string | null } | null
}

interface RawMatchSubstitution {
  minute?: number | null
  playerOut?: { id?: number | null; name?: string | null } | null
  playerIn?: { id?: number | null; name?: string | null } | null
}

interface RawScorersResponse {
  scorers: RawScorer[]
}

interface RawScorer {
  player: { id: number; name: string }
  team?: { id: number; name: string; crest: string | null } | null
  goals: number | null
  assists: number | null
  playedMatches: number | null
}

interface RawStandingsResponse {
  standings: Array<{
    stage?: string
    type?: string
    group?: string | null
    table: RawStandingsRow[]
  }>
}

interface RawStandingsRow {
  position: number
  team: { id: number; name: string; crest: string | null }
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
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
 * Fetch the full standings table for a competition + season.
 *
 * The football-data.org `/competitions/{id}/standings` response always
 * contains a `standings` array with one or more entries per stage / group;
 * for La Liga the array has a single entry of `type: "TOTAL"` covering the
 * whole season. We pick the TOTAL entry when present and fall back to the
 * first entry, then return the inner `table[]` already mapped to our
 * `NormalizedStandingsRow` shape.
 */
export async function getStandings(
  competitionId: number,
  season: number
): Promise<NormalizedStandingsRow[]> {
  const data = await apiFetch<RawStandingsResponse>(
    `/competitions/${competitionId}/standings?season=${season}`
  )
  if (!Array.isArray(data.standings) || data.standings.length === 0) return []

  const total =
    data.standings.find((s) => (s.type ?? '').toUpperCase() === 'TOTAL') ??
    data.standings[0]
  if (!total || !Array.isArray(total.table)) return []

  return total.table.map((row) => ({
    position: row.position,
    team: {
      id: row.team.id,
      name: row.team.name,
      crest: row.team.crest ?? null,
    },
    playedGames: row.playedGames,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    points: row.points,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
  }))
}

/**
 * Fetch the top N scorers for a competition + season.
 *
 * Sibling of `getScorers()` but tailored to the public dashboard widget:
 * caller-controlled `limit` (default 10), and the row payload includes the
 * scorer's team (name + crest) — `getScorers()` drops that because it is
 * only ever called for FCB players, where the team is implicit.
 */
export async function getTopScorers(
  competitionId: number,
  season: number,
  limit = 10
): Promise<NormalizedTopScorer[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  const data = await apiFetch<RawScorersResponse>(
    `/competitions/${competitionId}/scorers?season=${season}&limit=${safeLimit}`
  )
  if (!Array.isArray(data.scorers)) return []

  return data.scorers.map((s) => ({
    player: {
      id: s.player.id,
      name: s.player.name,
    },
    team: {
      name: s.team?.name ?? '',
      crest: s.team?.crest ?? null,
    },
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    playedMatches: s.playedMatches ?? 0,
  }))
}

/**
 * Fetch every match of a competition for a given season.
 *
 * Used by the /season aggregations: returns the entire competition fixture
 * list (e.g. all 380 La Liga matches), not just FCB ones, so we can build
 * round-by-round cumulative tables for every team.
 *
 * `matchday` is preserved as-is (may be null for tournament rounds where
 * upstream does not provide one — ignore those entries when aggregating).
 */
export async function getCompetitionMatches(
  competitionId: number,
  season: number
): Promise<NormalizedCompetitionMatch[]> {
  const data = await apiFetch<RawCompetitionMatchesResponse>(
    `/competitions/${competitionId}/matches?season=${season}`
  )
  if (!Array.isArray(data.matches)) return []

  return data.matches.map((m) => ({
    id: m.id,
    matchday: typeof m.matchday === 'number' ? m.matchday : null,
    utcDate: m.utcDate,
    status: normalizeMatchStatus(m.status),
    homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name },
    awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name },
    score: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
    },
  }))
}

/**
 * Fetch a single match with its event timeline (goals / bookings / subs).
 *
 * On the football-data.org free tier these arrays are not guaranteed to be
 * populated — many older or lower-tier matches expose the score only.
 * We always return arrays (never undefined/null) and set `partial = true`
 * when at least one category is missing or empty.
 */
export async function getMatchDetails(matchId: number): Promise<MatchDetails> {
  const data = await apiFetch<RawMatchDetailsResponse>(`/matches/${matchId}`)

  const goalsRaw = Array.isArray(data.goals) ? data.goals : []
  const bookingsRaw = Array.isArray(data.bookings) ? data.bookings : []
  const subsRaw = Array.isArray(data.substitutions) ? data.substitutions : []

  const goals: MatchGoalEvent[] = goalsRaw.map((g) => ({
    minute: typeof g.minute === 'number' ? g.minute : null,
    scorer: { id: g.scorer?.id ?? null, name: g.scorer?.name ?? null },
    type: g.type ?? null,
  }))

  const bookings: MatchBookingEvent[] = bookingsRaw.map((b) => ({
    minute: typeof b.minute === 'number' ? b.minute : null,
    player: { id: b.player?.id ?? null, name: b.player?.name ?? null },
    card: b.card ?? null,
  }))

  const substitutions: MatchSubstitutionEvent[] = subsRaw.map((s) => ({
    minute: typeof s.minute === 'number' ? s.minute : null,
    playerOut: {
      id: s.playerOut?.id ?? null,
      name: s.playerOut?.name ?? null,
    },
    playerIn: {
      id: s.playerIn?.id ?? null,
      name: s.playerIn?.name ?? null,
    },
  }))

  // "Partial" iff any of the three categories is empty AND the match is
  // already finished. For pre-match / live data, missing arrays are
  // expected and don't constitute a quality issue.
  const status = normalizeMatchStatus(data.status)
  const partial =
    status === 'FT' &&
    (goals.length === 0 || bookings.length === 0 || substitutions.length === 0)

  return {
    id: data.id,
    utcDate: data.utcDate,
    status,
    homeTeam: { id: data.homeTeam.id, name: data.homeTeam.name },
    awayTeam: { id: data.awayTeam.id, name: data.awayTeam.name },
    score: {
      home: data.score?.fullTime?.home ?? null,
      away: data.score?.fullTime?.away ?? null,
    },
    goals,
    bookings,
    substitutions,
    partial,
  }
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
