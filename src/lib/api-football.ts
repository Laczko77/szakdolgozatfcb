/**
 * Sofascore-backed football-stats client.
 *
 * Scope of this module:
 *   - Player statistics for the FC Barcelona first team — sourced from
 *     **Sofascore** via RapidAPI (`getPlayerStats`).
 *   - Single-match team-level statistics (possession, shots, corners,
 *     fouls, pass accuracy) — also sourced from **Sofascore**
 *     (`findSofascoreEventId` + `getSofascoreMatchStats`).
 *
 * Why Sofascore: football-data.org (used elsewhere for squad / standings /
 * matches / logos) does not surface per-player season totals beyond a
 * top-100 scorers list, and exposes no per-match team box score on the free
 * tier. Sofascore on RapidAPI returns full-roster stats with starts,
 * minutes and cards, plus a rich per-event statistics endpoint that covers
 * every metric we render on the match details page.
 *
 * The exported `getPlayerStats(season)` aggregates La Liga + Champions
 * League rows for every FCB player and returns a map keyed by the
 * **normalized full name**. The sync route joins this map against
 * `getSquad()` (football-data.org) on the same normalized name — there is
 * no shared player id between Sofascore and football-data.org.
 *
 * The exported `findSofascoreEventId` / `getSofascoreMatchStats` cross-
 * reference an FCB match by date and pull the team-level snapshot used by
 * the season match-detail route. football-data.org match IDs and Sofascore
 * event IDs are not shared, so the join is by `startDate` (UTC).
 *
 * Note: file is named `api-football.ts` for historical reasons — the
 * api-football.com provider was retired but the module path is preserved
 * so existing imports (`@/lib/api-football`) keep working without churn.
 */

const SOFASCORE_BASE_URL = 'https://sofascore.p.rapidapi.com'
const SOFASCORE_RAPIDAPI_HOST = 'sofascore.p.rapidapi.com'
const FCB_TEAM_ID_SOFASCORE = 2817
const LA_LIGA_TOURNAMENT_ID = 8
const CHAMPIONS_LEAGUE_TOURNAMENT_ID = 7

/**
 * Sofascore season-id mapping per FIFA-style start-year.
 *
 * Sofascore identifies seasons with opaque numeric IDs that change every
 * year, so we resolve them statically. To add a new season, fetch
 * `GET /teams/get-statistics-seasons?teamId=2817` and append the new IDs.
 */
const SOFASCORE_SEASON_IDS: Record<
  number,
  { laLiga: number; championsLeague: number }
> = {
  2023: { laLiga: 52376, championsLeague: 52162 },
  2024: { laLiga: 61643, championsLeague: 61644 },
  2025: { laLiga: 77559, championsLeague: 76953 },
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Raised when `SOFASCORE_RAPIDAPI_KEY` is missing.
 *
 * Class name is preserved (rather than renamed to `SofascoreConfigError`)
 * so existing catch blocks in the season match route — and any other
 * callers compiled against the previous interface — keep working without
 * changes. The message disambiguates the actual cause.
 */
export class ApiFootballConfigError extends Error {
  constructor(message = 'SOFASCORE_RAPIDAPI_KEY is not configured') {
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

/**
 * Public payload describing the per-side team statistics of a single match.
 *
 * `home` / `away` mirror the event's actual home/away sides as returned by
 * Sofascore — NOT FCB's perspective. The caller is responsible for mapping
 * these onto the FCB side using `match.homeTeam.id`.
 */
export interface FixtureTeamStats {
  home: TeamStatSnapshot
  away: TeamStatSnapshot
}

export interface TeamStatSnapshot {
  possession: number | null // 0-100 percent
  shots: number | null
  shots_on_target: number | null
  corners: number | null
  fouls: number | null
  pass_accuracy: number | null // 0-100 percent
}

// ---------------------------------------------------------------------------
// Raw response shapes — Sofascore (only the fields we read)
// ---------------------------------------------------------------------------

interface SofascoreSquadPlayer {
  id?: number
  name?: string | null
  shortName?: string | null
}

interface SofascoreSquadEntry {
  player?: SofascoreSquadPlayer | null
}

interface SofascoreSquadResponse {
  players?: SofascoreSquadEntry[] | null
}

/** Numeric season totals returned by `players/get-statistics`. */
interface SofascorePlayerStatistics {
  goals?: number | null
  assists?: number | null
  appearances?: number | null
  matchesStarted?: number | null
  minutesPlayed?: number | null
  yellowCards?: number | null
  redCards?: number | null
}

interface SofascorePlayerStatsResponse {
  statistics?: SofascorePlayerStatistics | null
  /**
   * When the player has no row for the requested tournament/season the
   * upstream still returns HTTP 200 but with an `error` envelope instead
   * of `statistics`. Treated as "no stats" by the caller.
   */
  error?: { code?: number; message?: string } | null
}

/** Single event entry returned by `teams/get-last-matches`. */
interface SofascoreEventListEntry {
  id?: number | null
  startTimestamp?: number | null
  status?: { type?: string | null } | null
  homeTeam?: { id?: number | null; name?: string | null } | null
  awayTeam?: { id?: number | null; name?: string | null } | null
}

interface SofascoreEventListResponse {
  events?: SofascoreEventListEntry[] | null
  hasNextPage?: boolean | null
}

interface SofascoreStatItem {
  key?: string | null
  homeValue?: number | null
  awayValue?: number | null
}

interface SofascoreStatGroup {
  groupName?: string | null
  statisticsItems?: SofascoreStatItem[] | null
}

interface SofascoreStatPeriod {
  period?: string | null
  groups?: SofascoreStatGroup[] | null
}

interface SofascoreMatchStatsResponse {
  statistics?: SofascoreStatPeriod[] | null
  error?: { code?: number; message?: string } | null
}

// ---------------------------------------------------------------------------
// Helpers — generic
// ---------------------------------------------------------------------------

/**
 * Normalize a player name for cross-provider matching.
 *
 * football-data.org returns names like "Marc-André ter Stegen", Sofascore
 * returns "Marc-André ter Stegen" too — but accents, hyphens and stray
 * whitespace can drift. After lowercasing, NFD-stripping diacritics, and
 * collapsing hyphens/apostrophes/whitespace the two should align on every
 * roster member.
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

function sofascoreHeaders(apiKey: string): HeadersInit {
  return {
    'x-rapidapi-host': SOFASCORE_RAPIDAPI_HOST,
    'x-rapidapi-key': apiKey,
    Accept: 'application/json',
  }
}

function requireSofascoreKey(): string {
  const apiKey = process.env.SOFASCORE_RAPIDAPI_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ApiFootballConfigError('SOFASCORE_RAPIDAPI_KEY is not configured')
  }
  return apiKey
}

// ---------------------------------------------------------------------------
// Player statistics
// ---------------------------------------------------------------------------

/**
 * Pull the FCB squad from Sofascore. Returns one entry per first-team player
 * with the Sofascore player id and display name — both required to call the
 * per-player statistics endpoint and to build the join key.
 *
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
async function fetchSofascoreSquad(
  apiKey: string
): Promise<Array<{ id: number; name: string }>> {
  const url = `${SOFASCORE_BASE_URL}/teams/get-squad?teamId=${FCB_TEAM_ID_SOFASCORE}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: sofascoreHeaders(apiKey),
      cache: 'no-store',
    })
  } catch (err) {
    throw new ApiFootballRequestError(
      err instanceof Error
        ? `network error contacting Sofascore: ${err.message}`
        : 'network error contacting Sofascore',
      null
    )
  }

  if (!response.ok) {
    throw new ApiFootballRequestError(
      `Sofascore returned HTTP ${response.status} for /teams/get-squad`,
      response.status
    )
  }

  let body: SofascoreSquadResponse
  try {
    body = (await response.json()) as SofascoreSquadResponse
  } catch (err) {
    throw new ApiFootballRequestError(
      err instanceof Error
        ? `invalid JSON from Sofascore squad: ${err.message}`
        : 'invalid JSON from Sofascore squad',
      response.status
    )
  }

  const out: Array<{ id: number; name: string }> = []
  const entries = Array.isArray(body.players) ? body.players : []
  for (const entry of entries) {
    const id = entry.player?.id
    const name = (entry.player?.name ?? '').trim()
    if (typeof id === 'number' && Number.isFinite(id) && name.length > 0) {
      out.push({ id, name })
    }
  }
  return out
}

/**
 * Fetch one player's per-tournament season totals from Sofascore.
 *
 * Returns `null` when:
 *   - the upstream returns its `{ "error": { "code": 404 } }` envelope
 *     (player has no row for that tournament/season — common for youth or
 *     newly-arrived players); or
 *   - the `statistics` block is missing for any other benign reason.
 *
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
async function fetchSofascorePlayerStats(
  playerId: number,
  tournamentId: number,
  seasonId: number,
  apiKey: string
): Promise<SofascorePlayerStatistics | null> {
  const url =
    `${SOFASCORE_BASE_URL}/players/get-statistics` +
    `?playerId=${playerId}&tournamentId=${tournamentId}` +
    `&seasonId=${seasonId}&type=overall`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: sofascoreHeaders(apiKey),
      cache: 'no-store',
    })
  } catch (err) {
    throw new ApiFootballRequestError(
      err instanceof Error
        ? `network error contacting Sofascore: ${err.message}`
        : 'network error contacting Sofascore',
      null
    )
  }

  if (!response.ok) {
    throw new ApiFootballRequestError(
      `Sofascore returned HTTP ${response.status} for /players/get-statistics`,
      response.status
    )
  }

  let body: SofascorePlayerStatsResponse
  try {
    body = (await response.json()) as SofascorePlayerStatsResponse
  } catch {
    return null // malformed JSON for a single player is non-fatal
  }

  // "No stats for this season" envelope — HTTP 200 with `error` instead of
  // `statistics`. Caller treats as zero contribution.
  if (body.error && typeof body.error === 'object') return null
  if (!body.statistics || typeof body.statistics !== 'object') return null

  return body.statistics
}

function accumulateSofascoreStats(
  dest: PlayerStatsPayload,
  src: SofascorePlayerStatistics
): void {
  dest.goals += safeNumber(src.goals)
  dest.assists += safeNumber(src.assists)
  dest.appearances += safeNumber(src.appearances)
  dest.games_started += safeNumber(src.matchesStarted)
  dest.minutes += safeNumber(src.minutesPlayed)
  dest.yellow_cards += safeNumber(src.yellowCards)
  dest.red_cards += safeNumber(src.redCards)
}

/**
 * Fetch all FC Barcelona player statistics for `season` from Sofascore,
 * aggregate La Liga + Champions League totals, and return a map keyed by
 * the normalized full name.
 *
 * Strategy (Sofascore has no team-wide "all players' stats" endpoint):
 *   1. Pull the FCB squad via `/teams/get-squad?teamId=2817` (one call).
 *   2. For every squad member, call `/players/get-statistics` twice — once
 *      per tournament — and sum the per-season totals.
 *
 * Players whose Sofascore row is missing for the requested season (the API
 * answers with a 404 envelope) contribute zero — the empty bucket is still
 * inserted so the caller can distinguish "matched the squad, no stats" from
 * "did not match the squad at all".
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors at the squad
 *         level. Per-player failures are non-fatal: that player gets zero
 *         contribution from the failing tournament.
 */
export async function getPlayerStats(
  season: number
): Promise<Map<string, PlayerStatsPayload>> {
  const apiKey = requireSofascoreKey()

  const seasonIds = SOFASCORE_SEASON_IDS[season]
  if (!seasonIds) {
    throw new ApiFootballRequestError(
      `Sofascore season-id mapping is not defined for season ${season}. ` +
        `Add it to SOFASCORE_SEASON_IDS in src/lib/api-football.ts.`,
      null
    )
  }

  const squad = await fetchSofascoreSquad(apiKey)
  const result = new Map<string, PlayerStatsPayload>()

  const tournaments: Array<{ id: number; seasonId: number }> = [
    { id: LA_LIGA_TOURNAMENT_ID, seasonId: seasonIds.laLiga },
    { id: CHAMPIONS_LEAGUE_TOURNAMENT_ID, seasonId: seasonIds.championsLeague },
  ]

  for (const member of squad) {
    const key = normalizePlayerName(member.name)
    if (key.length === 0) continue
    const bucket = result.get(key) ?? emptyStats()

    for (const t of tournaments) {
      const stats = await fetchSofascorePlayerStats(
        member.id,
        t.id,
        t.seasonId,
        apiKey
      )
      if (stats) accumulateSofascoreStats(bucket, stats)
    }

    result.set(key, bucket)
  }

  return result
}

// ---------------------------------------------------------------------------
// Match lookup + team statistics (used by /api/season/match/[id])
// ---------------------------------------------------------------------------

/**
 * How far back through the FCB match history we are willing to paginate when
 * looking for a Sofascore event by date. Each page is 30 finished matches,
 * so the default of 12 covers ~360 matches ≈ 5+ seasons of play — well
 * beyond the football-data.org window the season page renders.
 */
const SOFASCORE_EVENT_LOOKUP_MAX_PAGES = 12

/**
 * Resolve the Sofascore event ID for the FCB match played on the given UTC
 * date.
 *
 * football-data.org match IDs and Sofascore event IDs are not shared, so we
 * cross-reference by date. Sofascore exposes a paginated "team last matches"
 * feed sorted from most-recent to oldest in 30-event pages; we walk the
 * pages until we either hit the requested calendar day or paginate past it.
 *
 * Date matching is on the UTC calendar day (`YYYY-MM-DD`) — FCB plays at
 * most one match per day, so the first match on that day is unambiguous.
 *
 * @returns the Sofascore event id, or `null` when no FCB event exists for
 *          that date in the upstream history (legitimate miss — caller
 *          should treat as "stats unavailable").
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function findSofascoreEventId(
  utcDate: string
): Promise<number | null> {
  const apiKey = requireSofascoreKey()
  const targetDay = utcDate.slice(0, 10) // YYYY-MM-DD

  for (let page = 0; page < SOFASCORE_EVENT_LOOKUP_MAX_PAGES; page += 1) {
    const url =
      `${SOFASCORE_BASE_URL}/teams/get-last-matches` +
      `?teamId=${FCB_TEAM_ID_SOFASCORE}&pageIndex=${page}`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: sofascoreHeaders(apiKey),
        cache: 'no-store',
      })
    } catch (err) {
      throw new ApiFootballRequestError(
        err instanceof Error
          ? `network error contacting Sofascore: ${err.message}`
          : 'network error contacting Sofascore',
        null
      )
    }

    if (!response.ok) {
      throw new ApiFootballRequestError(
        `Sofascore returned HTTP ${response.status} for /teams/get-last-matches`,
        response.status
      )
    }

    let body: SofascoreEventListResponse
    try {
      body = (await response.json()) as SofascoreEventListResponse
    } catch (err) {
      throw new ApiFootballRequestError(
        err instanceof Error
          ? `invalid JSON from Sofascore last-matches: ${err.message}`
          : 'invalid JSON from Sofascore last-matches',
        response.status
      )
    }

    const events = Array.isArray(body.events) ? body.events : []
    if (events.length === 0) return null

    // Match on the UTC calendar day. Sofascore returns events with the
    // server's local kickoff timestamp normalised to a UNIX epoch second,
    // so converting via `new Date(ts * 1000).toISOString()` yields a
    // canonical UTC representation that aligns with football-data.org's
    // `utcDate`.
    let oldestDayOnPage: string | null = null
    for (const ev of events) {
      const ts = ev.startTimestamp
      if (typeof ts !== 'number' || !Number.isFinite(ts)) continue
      const day = new Date(ts * 1000).toISOString().slice(0, 10)
      if (oldestDayOnPage === null || day < oldestDayOnPage) {
        oldestDayOnPage = day
      }
      if (day === targetDay && typeof ev.id === 'number') {
        return ev.id
      }
    }

    // The feed is most-recent first. If we've already paged past the target
    // day there is no point continuing — bail out instead of exhausting the
    // quota on irrelevant history.
    if (oldestDayOnPage !== null && oldestDayOnPage < targetDay) {
      return null
    }

    if (body.hasNextPage === false) return null
  }

  return null
}

/**
 * Fetch the team-level statistics (possession, shots, corners, fouls, pass
 * accuracy) for both sides of a Sofascore event.
 *
 * The Sofascore endpoint groups stats into multiple periods (`ALL`, `1ST`,
 * `2ND`); we only consume the `ALL` period. Within that period the metrics
 * are spread across named groups (`Match overview`, `Shots`, `Passes`, ...);
 * we flatten them into a single key→item map and pick out the keys we care
 * about. Pass accuracy is computed from `accuratePasses / passes` because
 * the upstream does not expose a single "pass accuracy %" stat.
 *
 * @returns the parsed snapshots, or `null` when Sofascore reports an error
 *          envelope or returns no stats payload (both are non-fatal — the
 *          caller logs a warning).
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreMatchStats(
  eventId: number
): Promise<FixtureTeamStats | null> {
  const apiKey = requireSofascoreKey()
  const url = `${SOFASCORE_BASE_URL}/matches/get-statistics?matchId=${eventId}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: sofascoreHeaders(apiKey),
      cache: 'no-store',
    })
  } catch (err) {
    throw new ApiFootballRequestError(
      err instanceof Error
        ? `network error contacting Sofascore: ${err.message}`
        : 'network error contacting Sofascore',
      null
    )
  }

  if (!response.ok) {
    // 404 here means "no stats published yet for this event" — treat as
    // missing rather than as a hard error so the route can still cache.
    if (response.status === 404) return null
    throw new ApiFootballRequestError(
      `Sofascore returned HTTP ${response.status} for /matches/get-statistics`,
      response.status
    )
  }

  let body: SofascoreMatchStatsResponse
  try {
    body = (await response.json()) as SofascoreMatchStatsResponse
  } catch {
    return null
  }

  if (body.error && typeof body.error === 'object') return null

  const periods = Array.isArray(body.statistics) ? body.statistics : []
  const allPeriod = periods.find((p) => p.period === 'ALL')
  if (!allPeriod) return null

  const items = flattenStatItems(allPeriod.groups ?? [])

  // `totalShotsOnGoal` is Sofascore's confusingly-named key for "Total
  // shots" (verified against the live response); `shotsOnGoal` is the
  // actual on-target count.
  const homeTotalShots = pickNumber(items, 'totalShotsOnGoal', 'home')
  const awayTotalShots = pickNumber(items, 'totalShotsOnGoal', 'away')
  const homeShotsOnTarget = pickNumber(items, 'shotsOnGoal', 'home')
  const awayShotsOnTarget = pickNumber(items, 'shotsOnGoal', 'away')

  return {
    home: {
      possession: pickNumber(items, 'ballPossession', 'home'),
      shots: homeTotalShots,
      shots_on_target: homeShotsOnTarget,
      corners: pickNumber(items, 'cornerKicks', 'home'),
      fouls: pickNumber(items, 'fouls', 'home'),
      pass_accuracy: passAccuracy(
        pickNumber(items, 'accuratePasses', 'home'),
        pickNumber(items, 'passes', 'home')
      ),
    },
    away: {
      possession: pickNumber(items, 'ballPossession', 'away'),
      shots: awayTotalShots,
      shots_on_target: awayShotsOnTarget,
      corners: pickNumber(items, 'cornerKicks', 'away'),
      fouls: pickNumber(items, 'fouls', 'away'),
      pass_accuracy: passAccuracy(
        pickNumber(items, 'accuratePasses', 'away'),
        pickNumber(items, 'passes', 'away')
      ),
    },
  }
}

function flattenStatItems(
  groups: SofascoreStatGroup[]
): Map<string, SofascoreStatItem> {
  // First occurrence wins — the `Match overview` group lists the canonical
  // values first, and per-section groups (`Shots`, `Defending`, ...) may
  // re-emit a key with a recomputed `homeValue` (e.g. `wonTacklePercent`
  // appears as a percentage in one group and a raw count in another). We
  // freeze the first hit because the early groups carry the values we want.
  const out = new Map<string, SofascoreStatItem>()
  for (const group of groups) {
    const entries = Array.isArray(group.statisticsItems)
      ? group.statisticsItems
      : []
    for (const item of entries) {
      if (!item.key) continue
      if (!out.has(item.key)) out.set(item.key, item)
    }
  }
  return out
}

function pickNumber(
  items: Map<string, SofascoreStatItem>,
  key: string,
  side: 'home' | 'away'
): number | null {
  const item = items.get(key)
  if (!item) return null
  const value = side === 'home' ? item.homeValue : item.awayValue
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function passAccuracy(
  accurate: number | null,
  total: number | null
): number | null {
  if (accurate === null || total === null) return null
  if (total <= 0) return null
  return Math.round((accurate / total) * 100)
}

// ---------------------------------------------------------------------------
// Extended single-match endpoints — lineups / incidents / shotmap / graph /
// best players. Used by /api/season/match/[id] alongside the team stats
// snapshot to render a rich match-detail page.
//
// All five endpoints share the same upstream contract:
//   - HTTP 200 with the documented payload on success
//   - HTTP 200 with `{ "error": { "code": 404, ... } }` envelope when the
//     event has no data (treated as null / empty)
//   - non-2xx HTTP statuses are propagated as ApiFootballRequestError
// ---------------------------------------------------------------------------

// Public types -------------------------------------------------------------

export interface SofascoreLineupsPayload {
  confirmed: boolean
  homeFormation: string | null
  awayFormation: string | null
  home: SofascoreLineupPlayer[]
  away: SofascoreLineupPlayer[]
}

export interface SofascoreLineupPlayer {
  id: number
  name: string
  jerseyNumber: number | null
  position: string | null
  substitute: boolean
  stats: {
    rating: number | null
    minutesPlayed: number | null
    goals: number | null
    assists: number | null
    yellowCard: boolean
    redCard: boolean
    saves: number | null
    totalPass: number | null
    accuratePass: number | null
  }
}

export interface SofascoreIncident {
  type: string
  time: number
  addedTime: number | null
  isHome: boolean | null
  playerName: string | null
  playerInName: string | null
  playerOutName: string | null
  homeScore: number | null
  awayScore: number | null
  cardType: string | null
  goalType: string | null
  description: string | null
}

export interface SofascoreShotmapEntry {
  playerId: number | null
  playerName: string | null
  isHome: boolean
  shotType: string
  bodyPart: string | null
  situation: string | null
  xg: number | null
  playerCoordinates: { x: number; y: number } | null
  goalMouthCoordinates: { x: number; y: number } | null
}

export interface SofascoreGraphPoint {
  minute: number
  value: number
}

export interface SofascoreBestPlayer {
  id: number
  name: string
  rating: number | null
}

export interface SofascoreBestPlayers {
  home: SofascoreBestPlayer | null
  away: SofascoreBestPlayer | null
}

export interface SofascoreTeamStatistics {
  goalsScored: number | null
  goalsConceded: number | null
  assists: number | null
  shots: number | null
  shotsOnTarget: number | null
  bigChances: number | null
  successfulDribbles: number | null
  totalPasses: number | null
  accuratePassesPercentage: number | null
  cleanSheets: number | null
  tackles: number | null
  interceptions: number | null
  saves: number | null
  duelsWon: number | null
  avgRating: number | null
}

export interface SofascoreTransferEntry {
  playerName: string
  playerId: number | null
  direction: 'in' | 'out'
  fromTeam: string | null
  toTeam: string | null
  transferDate: string | null
  fee: number | null
  feeCurrency: string | null
  transferType: string | null
}

export interface SofascoreTransfersPayload {
  transfersIn: SofascoreTransferEntry[]
  transfersOut: SofascoreTransferEntry[]
}

// Raw upstream shapes ------------------------------------------------------

interface RawLineupPlayerStats {
  rating?: number | null
  minutesPlayed?: number | null
  goals?: number | null
  goalAssist?: number | null
  saves?: number | null
  totalPass?: number | null
  accuratePass?: number | null
}

interface RawLineupPlayerWrapper {
  player?: {
    id?: number | null
    name?: string | null
    jerseyNumber?: string | number | null
    position?: string | null
  } | null
  jerseyNumber?: string | number | null
  position?: string | null
  substitute?: boolean | null
  statistics?: RawLineupPlayerStats | null
  shirtNumber?: number | null
}

interface RawLineupSide {
  formation?: string | null
  players?: RawLineupPlayerWrapper[] | null
}

interface RawLineupsResponse {
  confirmed?: boolean | null
  home?: RawLineupSide | null
  away?: RawLineupSide | null
  error?: { code?: number; message?: string } | null
}

interface RawIncident {
  incidentType?: string | null
  incidentClass?: string | null
  time?: number | null
  addedTime?: number | null
  isHome?: boolean | null
  player?: { name?: string | null } | null
  playerIn?: { name?: string | null } | null
  playerOut?: { name?: string | null } | null
  homeScore?: number | null
  awayScore?: number | null
  text?: string | null
  description?: string | null
  reason?: string | null
}

interface RawIncidentsResponse {
  incidents?: RawIncident[] | null
  error?: { code?: number; message?: string } | null
}

interface RawShot {
  player?: { id?: number | null; name?: string | null } | null
  isHome?: boolean | null
  shotType?: string | null
  bodyPart?: string | null
  situation?: string | null
  xg?: number | null
  expectedGoals?: number | null
  playerCoordinates?: { x?: number | null; y?: number | null } | null
  goalMouthCoordinates?: { x?: number | null; y?: number | null } | null
}

interface RawShotmapResponse {
  shotmap?: RawShot[] | null
  error?: { code?: number; message?: string } | null
}

interface RawGraphPoint {
  minute?: number | null
  value?: number | null
}

interface RawGraphResponse {
  graphPoints?: RawGraphPoint[] | null
  error?: { code?: number; message?: string } | null
}

interface RawBestPlayer {
  player?: { id?: number | null; name?: string | null } | null
  value?: string | number | null
  rating?: number | null
}

interface RawBestPlayersResponse {
  bestHomeTeamPlayer?: RawBestPlayer | null
  bestAwayTeamPlayer?: RawBestPlayer | null
  error?: { code?: number; message?: string } | null
}

interface RawTeamStatItem {
  name?: string | null
  value?: number | string | null
}

interface RawTeamStatGroup {
  group?: string | null
  groupName?: string | null
  statisticsItems?: RawTeamStatItem[] | null
}

interface RawTeamStatisticsResponse {
  statistics?: RawTeamStatGroup[] | RawTeamStatItem[] | null
  error?: { code?: number; message?: string } | null
}

interface RawTransfer {
  player?: { id?: number | null; name?: string | null } | null
  transferFrom?: { name?: string | null } | null
  transferTo?: { name?: string | null } | null
  fromTeamName?: string | null
  toTeamName?: string | null
  transferDateTimestamp?: number | null
  transferDate?: number | null
  transferFee?: number | null
  transferFeeRaw?: { value?: number | null; currency?: string | null } | null
  transferFeeDescription?: string | null
  type?: number | null
  transferType?: string | null
}

interface RawTransfersResponse {
  transfersIn?: RawTransfer[] | null
  transfersOut?: RawTransfer[] | null
  error?: { code?: number; message?: string } | null
}

// Generic fetch helper -----------------------------------------------------

/**
 * Issue a GET against a Sofascore endpoint, parse JSON, and return the body
 * plus a "soft-not-found" hint. The hint is true when the upstream answers
 * 200 with its `{ "error": { "code": 404 } }` envelope OR the parser fails;
 * callers translate that into `null` / `[]` per their public contract.
 *
 * @throws {ApiFootballRequestError} on non-2xx HTTP statuses (other than 404
 *         which is mapped to softNotFound) or network errors.
 */
async function sofascoreGet<T>(
  path: string,
  apiKey: string
): Promise<{ body: T | null; softNotFound: boolean }> {
  const url = `${SOFASCORE_BASE_URL}${path}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: sofascoreHeaders(apiKey),
      cache: 'no-store',
    })
  } catch (err) {
    throw new ApiFootballRequestError(
      err instanceof Error
        ? `network error contacting Sofascore: ${err.message}`
        : 'network error contacting Sofascore',
      null
    )
  }

  if (response.status === 404) {
    return { body: null, softNotFound: true }
  }

  if (!response.ok) {
    throw new ApiFootballRequestError(
      `Sofascore returned HTTP ${response.status} for ${path}`,
      response.status
    )
  }

  let body: T & { error?: { code?: number } | null }
  try {
    body = (await response.json()) as T & { error?: { code?: number } | null }
  } catch {
    return { body: null, softNotFound: true }
  }

  if (body && typeof body === 'object' && body.error && typeof body.error === 'object') {
    return { body: null, softNotFound: true }
  }

  return { body, softNotFound: false }
}

function nullableNumber(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function parseJersey(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// Lineups ------------------------------------------------------------------

/**
 * Starting XI + substitutes + per-player match statistics for both sides.
 *
 * Returns `null` when the upstream has no published lineup for the event
 * (common for very old or future matches) — caller renders an "unavailable"
 * state.
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreLineups(
  eventId: number
): Promise<SofascoreLineupsPayload | null> {
  const apiKey = requireSofascoreKey()
  const { body, softNotFound } = await sofascoreGet<RawLineupsResponse>(
    `/matches/get-lineups?matchId=${eventId}`,
    apiKey
  )
  if (softNotFound || !body) return null

  return {
    confirmed: body.confirmed === true,
    homeFormation: body.home?.formation ?? null,
    awayFormation: body.away?.formation ?? null,
    home: extractLineupPlayers(body.home?.players ?? []),
    away: extractLineupPlayers(body.away?.players ?? []),
  }
}

function extractLineupPlayers(
  raw: RawLineupPlayerWrapper[]
): SofascoreLineupPlayer[] {
  const out: SofascoreLineupPlayer[] = []
  for (const entry of raw) {
    const playerId = entry.player?.id
    const name = (entry.player?.name ?? '').trim()
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) continue
    if (name.length === 0) continue

    const stats = entry.statistics ?? {}
    out.push({
      id: playerId,
      name,
      jerseyNumber:
        parseJersey(entry.jerseyNumber) ??
        parseJersey(entry.shirtNumber) ??
        parseJersey(entry.player?.jerseyNumber),
      position: entry.position ?? entry.player?.position ?? null,
      substitute: entry.substitute === true,
      stats: {
        rating: nullableNumber(stats.rating),
        minutesPlayed: nullableNumber(stats.minutesPlayed),
        goals: nullableNumber(stats.goals),
        assists: nullableNumber(stats.goalAssist),
        yellowCard: false, // populated from incidents on the consumer side
        redCard: false,
        saves: nullableNumber(stats.saves),
        totalPass: nullableNumber(stats.totalPass),
        accuratePass: nullableNumber(stats.accuratePass),
      },
    })
  }
  return out
}

// Incidents ----------------------------------------------------------------

/**
 * Match timeline events (goals, cards, substitutions, VAR decisions, period
 * markers). Returns an empty array when the upstream has nothing or returns
 * its 404 envelope.
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreIncidents(
  eventId: number
): Promise<SofascoreIncident[]> {
  const apiKey = requireSofascoreKey()
  const { body, softNotFound } = await sofascoreGet<RawIncidentsResponse>(
    `/matches/get-incidents?matchId=${eventId}`,
    apiKey
  )
  if (softNotFound || !body) return []

  const incidents = Array.isArray(body.incidents) ? body.incidents : []
  const out: SofascoreIncident[] = []
  for (const inc of incidents) {
    const type = (inc.incidentType ?? '').trim()
    if (type.length === 0) continue
    const time = nullableNumber(inc.time)
    if (time === null) continue

    out.push({
      type,
      time,
      addedTime: nullableNumber(inc.addedTime),
      isHome: typeof inc.isHome === 'boolean' ? inc.isHome : null,
      playerName: inc.player?.name ?? null,
      playerInName: inc.playerIn?.name ?? null,
      playerOutName: inc.playerOut?.name ?? null,
      homeScore: nullableNumber(inc.homeScore),
      awayScore: nullableNumber(inc.awayScore),
      cardType: type === 'card' ? inc.incidentClass ?? null : null,
      goalType: type === 'goal' ? inc.incidentClass ?? null : null,
      description: inc.text ?? inc.description ?? inc.reason ?? null,
    })
  }
  return out
}

// Shotmap ------------------------------------------------------------------

/**
 * Spatial shot data (player, location, body part, xG). Returns an empty
 * array on soft-not-found.
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreShotmap(
  eventId: number
): Promise<SofascoreShotmapEntry[]> {
  const apiKey = requireSofascoreKey()
  const { body, softNotFound } = await sofascoreGet<RawShotmapResponse>(
    `/matches/get-shotmap?matchId=${eventId}`,
    apiKey
  )
  if (softNotFound || !body) return []

  const shots = Array.isArray(body.shotmap) ? body.shotmap : []
  const out: SofascoreShotmapEntry[] = []
  for (const shot of shots) {
    const shotType = (shot.shotType ?? '').trim()
    if (shotType.length === 0) continue

    out.push({
      playerId: nullableNumber(shot.player?.id),
      playerName: shot.player?.name ?? null,
      isHome: shot.isHome === true,
      shotType,
      bodyPart: shot.bodyPart ?? null,
      situation: shot.situation ?? null,
      xg: nullableNumber(shot.xg) ?? nullableNumber(shot.expectedGoals),
      playerCoordinates: extractCoords(shot.playerCoordinates),
      goalMouthCoordinates: extractCoords(shot.goalMouthCoordinates),
    })
  }
  return out
}

function extractCoords(
  raw: { x?: number | null; y?: number | null } | null | undefined
): { x: number; y: number } | null {
  if (!raw) return null
  const x = nullableNumber(raw.x)
  const y = nullableNumber(raw.y)
  if (x === null || y === null) return null
  return { x, y }
}

// Graph (momentum) ---------------------------------------------------------

/**
 * Match momentum chart — minute-by-minute pressure values where positive
 * favors the home side.
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreGraph(
  eventId: number
): Promise<SofascoreGraphPoint[]> {
  const apiKey = requireSofascoreKey()
  const { body, softNotFound } = await sofascoreGet<RawGraphResponse>(
    `/matches/get-graph?matchId=${eventId}`,
    apiKey
  )
  if (softNotFound || !body) return []

  const points = Array.isArray(body.graphPoints) ? body.graphPoints : []
  const out: SofascoreGraphPoint[] = []
  for (const p of points) {
    const minute = nullableNumber(p.minute)
    const value = nullableNumber(p.value)
    if (minute === null || value === null) continue
    out.push({ minute, value })
  }
  return out
}

// Best players -------------------------------------------------------------

/**
 * "Player of the match" pick for each side, with their Sofascore rating.
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreBestPlayers(
  eventId: number
): Promise<SofascoreBestPlayers | null> {
  const apiKey = requireSofascoreKey()
  const { body, softNotFound } = await sofascoreGet<RawBestPlayersResponse>(
    `/matches/get-best-players?matchId=${eventId}`,
    apiKey
  )
  if (softNotFound || !body) return null

  return {
    home: pickBestPlayer(body.bestHomeTeamPlayer ?? null),
    away: pickBestPlayer(body.bestAwayTeamPlayer ?? null),
  }
}

function pickBestPlayer(raw: RawBestPlayer | null): SofascoreBestPlayer | null {
  if (!raw) return null
  const id = nullableNumber(raw.player?.id)
  const name = raw.player?.name ?? null
  if (id === null || !name) return null

  // `value` is a string like "8.4" on this endpoint; `rating` may also be
  // present numerically depending on locale.
  let rating: number | null = nullableNumber(raw.rating)
  if (rating === null && typeof raw.value === 'string') {
    const parsed = Number.parseFloat(raw.value)
    rating = Number.isFinite(parsed) ? parsed : null
  } else if (rating === null && typeof raw.value === 'number') {
    rating = Number.isFinite(raw.value) ? raw.value : null
  }

  return { id, name, rating }
}

// Team season statistics ---------------------------------------------------

/**
 * FCB season aggregates for a single competition (`tournamentId` /
 * `seasonId`). Returns `null` on soft-not-found.
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreTeamStatistics(
  tournamentId: number,
  seasonId: number
): Promise<SofascoreTeamStatistics | null> {
  const apiKey = requireSofascoreKey()
  const path =
    `/teams/get-statistics` +
    `?teamId=${FCB_TEAM_ID_SOFASCORE}` +
    `&tournamentId=${tournamentId}` +
    `&seasonId=${seasonId}` +
    `&type=overall`
  const { body, softNotFound } = await sofascoreGet<RawTeamStatisticsResponse>(
    path,
    apiKey
  )
  if (softNotFound || !body) return null

  // The endpoint may return either a flat `statistics` object, an array of
  // groups, or an array of items — flatten everything into a name→value map.
  const map = flattenTeamStatItems(body.statistics)

  return {
    goalsScored: pickStat(map, ['goalsScored', 'goals']),
    goalsConceded: pickStat(map, ['goalsConceded']),
    assists: pickStat(map, ['assists']),
    shots: pickStat(map, ['shots', 'totalShots']),
    shotsOnTarget: pickStat(map, ['shotsOnTarget']),
    bigChances: pickStat(map, ['bigChances', 'bigChancesCreated']),
    successfulDribbles: pickStat(map, ['successfulDribbles']),
    totalPasses: pickStat(map, ['totalPasses', 'passes']),
    accuratePassesPercentage: pickStat(map, [
      'accuratePassesPercentage',
      'accuratePassPercentage',
    ]),
    cleanSheets: pickStat(map, ['cleanSheets']),
    tackles: pickStat(map, ['tackles']),
    interceptions: pickStat(map, ['interceptions']),
    saves: pickStat(map, ['saves']),
    duelsWon: pickStat(map, ['duelsWon']),
    avgRating: pickStat(map, ['avgRating', 'averageRating']),
  }
}

function flattenTeamStatItems(
  raw: RawTeamStatGroup[] | RawTeamStatItem[] | null | undefined
): Map<string, number> {
  const out = new Map<string, number>()
  if (!Array.isArray(raw)) {
    // Direct object form: each property = stat key
    if (raw && typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw)) {
        const n = nullableNumber(value)
        if (n !== null && !out.has(key)) out.set(key, n)
      }
    }
    return out
  }

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    // Group form: { groupName, statisticsItems: [...] }
    const items = (entry as RawTeamStatGroup).statisticsItems
    if (Array.isArray(items)) {
      for (const item of items) {
        const key = item.name?.trim()
        if (!key) continue
        const num = parseStatNumber(item.value)
        if (num !== null && !out.has(key)) out.set(key, num)
      }
      continue
    }
    // Flat-item form: { name, value }
    const flat = entry as RawTeamStatItem
    const key = flat.name?.trim()
    if (!key) continue
    const num = parseStatNumber(flat.value)
    if (num !== null && !out.has(key)) out.set(key, num)
  }
  return out
}

function parseStatNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.replace('%', ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function pickStat(map: Map<string, number>, keys: string[]): number | null {
  for (const key of keys) {
    const v = map.get(key)
    if (typeof v === 'number') return v
  }
  return null
}

// Transfers ----------------------------------------------------------------

/**
 * Latest FCB transfer activity, split into incoming and outgoing moves.
 * Always returns a payload with both arrays — empty when the upstream has
 * nothing to report.
 *
 * @throws {ApiFootballConfigError} when `SOFASCORE_RAPIDAPI_KEY` is missing
 * @throws {ApiFootballRequestError} on network / HTTP errors
 */
export async function getSofascoreTransfers(): Promise<SofascoreTransfersPayload> {
  const apiKey = requireSofascoreKey()
  const { body, softNotFound } = await sofascoreGet<RawTransfersResponse>(
    `/teams/get-transfers?teamId=${FCB_TEAM_ID_SOFASCORE}`,
    apiKey
  )
  if (softNotFound || !body) {
    return { transfersIn: [], transfersOut: [] }
  }

  return {
    transfersIn: (body.transfersIn ?? []).map((t) => mapTransfer(t, 'in')),
    transfersOut: (body.transfersOut ?? []).map((t) => mapTransfer(t, 'out')),
  }
}

function mapTransfer(
  raw: RawTransfer,
  direction: 'in' | 'out'
): SofascoreTransferEntry {
  const ts = nullableNumber(raw.transferDateTimestamp) ?? nullableNumber(raw.transferDate)
  const transferDate = ts !== null ? new Date(ts * 1000).toISOString() : null

  const fromTeam =
    raw.transferFrom?.name ?? raw.fromTeamName ?? null
  const toTeam = raw.transferTo?.name ?? raw.toTeamName ?? null

  // `type` is sometimes a numeric enum (1=Transfer, 2=Loan, 3=Free); when
  // missing we pass through the textual `transferType` if upstream provides
  // it. The frontend handles either.
  let transferType: string | null = null
  if (typeof raw.transferType === 'string' && raw.transferType.trim().length > 0) {
    transferType = raw.transferType.trim()
  } else if (typeof raw.type === 'number') {
    transferType = mapTransferTypeCode(raw.type)
  } else if (raw.transferFeeDescription) {
    transferType = raw.transferFeeDescription
  }

  return {
    playerName: raw.player?.name ?? '',
    playerId: nullableNumber(raw.player?.id),
    direction,
    fromTeam,
    toTeam,
    transferDate,
    fee:
      nullableNumber(raw.transferFeeRaw?.value) ??
      nullableNumber(raw.transferFee),
    feeCurrency: raw.transferFeeRaw?.currency ?? null,
    transferType,
  }
}

function mapTransferTypeCode(code: number): string | null {
  switch (code) {
    case 1:
      return 'Transfer'
    case 2:
      return 'Loan'
    case 3:
      return 'Free'
    default:
      return null
  }
}

/**
 * Public read of the season-id mapping — used by routes that need to look up
 * a tournament/season pair from the user-facing year.
 */
export function getSofascoreSeasonIds(season: number):
  | { laLiga: number; championsLeague: number }
  | null {
  return SOFASCORE_SEASON_IDS[season] ?? null
}

export const SOFASCORE_TOURNAMENT_IDS = {
  laLiga: LA_LIGA_TOURNAMENT_ID,
  championsLeague: CHAMPIONS_LEAGUE_TOURNAMENT_ID,
} as const
