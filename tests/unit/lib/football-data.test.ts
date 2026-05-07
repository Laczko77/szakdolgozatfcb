import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock global fetch before importing the module so no real HTTP calls happen.
// ---------------------------------------------------------------------------
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import {
  currentSeasonStartYear,
  getSquad,
  getMatches,
  getScorers,
  getStandings,
  getTopScorers,
  FootballDataConfigError,
  FootballDataRequestError,
  BASE_URL,
  FCB_TEAM_ID,
  LA_LIGA_COMPETITION_ID,
  CHAMPIONS_LEAGUE_COMPETITION_ID,
} from '@/lib/football-data'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/** Minimal Response mock that reports ok=true and returns the given body. */
function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

/** Minimal Response mock that reports ok=false with the given status. */
function errorResponse(status: number, statusText = 'Error'): Response {
  return {
    ok: false,
    status,
    statusText,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('exported constants', () => {
  it('BASE_URL is the football-data.org v4 endpoint', () => {
    expect(BASE_URL).toBe('https://api.football-data.org/v4')
  })

  it('FCB_TEAM_ID is 81', () => {
    expect(FCB_TEAM_ID).toBe(81)
  })

  it('LA_LIGA_COMPETITION_ID is 2014', () => {
    expect(LA_LIGA_COMPETITION_ID).toBe(2014)
  })

  it('CHAMPIONS_LEAGUE_COMPETITION_ID is 2001', () => {
    expect(CHAMPIONS_LEAGUE_COMPETITION_ID).toBe(2001)
  })
})

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe('FootballDataConfigError', () => {
  it('has the correct message', () => {
    const err = new FootballDataConfigError()
    expect(err.message).toBe('FOOTBALL_DATA_API_KEY environment variable is not set')
  })

  it('has name FootballDataConfigError', () => {
    expect(new FootballDataConfigError().name).toBe('FootballDataConfigError')
  })

  it('is an instance of Error', () => {
    expect(new FootballDataConfigError()).toBeInstanceOf(Error)
  })
})

describe('FootballDataRequestError', () => {
  it('stores the status code', () => {
    const err = new FootballDataRequestError('rate limit', 429)
    expect(err.status).toBe(429)
  })

  it('stores the message', () => {
    const err = new FootballDataRequestError('forbidden', 403)
    expect(err.message).toBe('forbidden')
  })

  it('has name FootballDataRequestError', () => {
    expect(new FootballDataRequestError('x', 500).name).toBe('FootballDataRequestError')
  })

  it('is an instance of Error', () => {
    expect(new FootballDataRequestError('x', 502)).toBeInstanceOf(Error)
  })
})

// ---------------------------------------------------------------------------
// currentSeasonStartYear
// ---------------------------------------------------------------------------

describe('currentSeasonStartYear', () => {
  it('returns the current year on August 1 (UTC month index 7 — season starts)', () => {
    expect(currentSeasonStartYear(utcDate(2025, 8, 1))).toBe(2025)
  })

  it('returns the current year on December 31 (deep into the season)', () => {
    expect(currentSeasonStartYear(utcDate(2025, 12, 31))).toBe(2025)
  })

  it('returns the current year on September 15', () => {
    expect(currentSeasonStartYear(utcDate(2025, 9, 15))).toBe(2025)
  })

  it('returns previous year on July 31 (UTC month index 6 — still previous season)', () => {
    expect(currentSeasonStartYear(utcDate(2025, 7, 31))).toBe(2024)
  })

  it('returns previous year on January 1 (early in calendar year, previous season)', () => {
    expect(currentSeasonStartYear(utcDate(2025, 1, 1))).toBe(2024)
  })

  it('returns previous year on March 10', () => {
    expect(currentSeasonStartYear(utcDate(2026, 3, 10))).toBe(2025)
  })

  it('returns previous year on February 29 of a leap year (2024)', () => {
    expect(currentSeasonStartYear(utcDate(2024, 2, 29))).toBe(2023)
  })

  it('returns a number when called with no argument (uses current date)', () => {
    expect(typeof currentSeasonStartYear()).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// apiFetch — tested indirectly through the public helpers
// ---------------------------------------------------------------------------

describe('apiFetch (via getSquad)', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...OLD_ENV, FOOTBALL_DATA_API_KEY: 'test-key' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('throws FootballDataConfigError when the API key env var is not set', async () => {
    delete process.env.FOOTBALL_DATA_API_KEY

    await expect(getSquad()).rejects.toBeInstanceOf(FootballDataConfigError)
  })

  it('throws FootballDataRequestError with status 429 on rate-limit response', async () => {
    fetchMock.mockResolvedValue(errorResponse(429, 'Too Many Requests'))

    await expect(getSquad()).rejects.toMatchObject({ status: 429 })
  })

  it('throws FootballDataRequestError with status 403 on forbidden response', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, 'Forbidden'))

    await expect(getSquad()).rejects.toMatchObject({ status: 403 })
  })

  it('throws FootballDataRequestError for a generic non-ok response', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'Internal Server Error'))

    await expect(getSquad()).rejects.toBeInstanceOf(FootballDataRequestError)
  })

  it('throws FootballDataRequestError on network error', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'))

    await expect(getSquad()).rejects.toBeInstanceOf(FootballDataRequestError)
  })

  it('throws FootballDataRequestError on AbortError (timeout)', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValue(abortError)

    const err = await getSquad().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FootballDataRequestError)
    expect((err as FootballDataRequestError).status).toBe(504)
  })

  it('sends X-Auth-Token header with the API key', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: FCB_TEAM_ID, name: 'FC Barcelona', squad: [] }))

    await getSquad()
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-Auth-Token']).toBe('test-key')
  })

  it('requests the correct URL for getSquad', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: FCB_TEAM_ID, name: 'FC Barcelona', squad: [] }))

    await getSquad()
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE_URL}/teams/${FCB_TEAM_ID}`)
  })
})

// ---------------------------------------------------------------------------
// getSquad
// ---------------------------------------------------------------------------

describe('getSquad', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...OLD_ENV, FOOTBALL_DATA_API_KEY: 'test-key' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('returns an empty array when the squad field is not an array', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: FCB_TEAM_ID, name: 'FC Barcelona', squad: null }))

    const result = await getSquad()
    expect(result).toEqual([])
  })

  it('returns an empty array when squad is missing from response', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: FCB_TEAM_ID, name: 'FC Barcelona' }))

    const result = await getSquad()
    expect(result).toEqual([])
  })

  it('maps squad members to SquadPlayer shape', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID,
      name: 'FC Barcelona',
      squad: [
        { id: 1, name: 'Ter Stegen', position: 'Goalkeeper', shirtNumber: 1, dateOfBirth: '1992-04-30', nationality: 'Germany' },
      ],
    }))

    const result = await getSquad()
    expect(result).toEqual([
      { id: 1, name: 'Ter Stegen', position: 'Goalkeeper', shirtNumber: 1, dateOfBirth: '1992-04-30', nationality: 'Germany' },
    ])
  })

  it('normalizes "Defence" position to "Defender"', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 2, name: 'Araujo', position: 'Defence' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Defender')
  })

  it('normalizes "Midfield" position to "Midfielder"', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 3, name: 'Pedri', position: 'Midfield' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Midfielder')
  })

  it('normalizes "Offence" position to "Attacker"', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 4, name: 'Lewandowski', position: 'Offence' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Attacker')
  })

  it('keeps "Goalkeeper" position as-is', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 5, name: 'Pena', position: 'Goalkeeper' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Goalkeeper')
  })

  it('returns null position for unknown position strings', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 6, name: 'Staff', position: 'Coach' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBeNull()
  })

  it('returns null position when position is null', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 7, name: 'Unknown', position: null }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBeNull()
  })

  it('falls back shirtNumber to null when missing', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 8, name: 'Player', position: 'Midfield' }],
    }))

    const [player] = await getSquad()
    expect(player.shirtNumber).toBeNull()
  })

  it('normalizes position using fuzzy matching — "goalkeeper" substring', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 9, name: 'P', position: 'Deputy goalkeeper' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Goalkeeper')
  })

  it('normalizes position using fuzzy matching — "back" substring → Defender', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 10, name: 'P', position: 'Full back' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Defender')
  })

  it('normalizes position using fuzzy matching — "forward" substring → Attacker', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 11, name: 'P', position: 'Centre forward' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Attacker')
  })

  it('normalizes position using fuzzy matching — "winger" substring → Attacker', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 12, name: 'P', position: 'Left winger' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Attacker')
  })

  it('normalizes position using fuzzy matching — "striker" substring → Attacker', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 13, name: 'P', position: 'Target striker' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Attacker')
  })

  it('normalizes position using fuzzy matching — "midfield" substring → Midfielder', async () => {
    fetchMock.mockResolvedValue(okResponse({
      id: FCB_TEAM_ID, name: 'FC Barcelona',
      squad: [{ id: 14, name: 'P', position: 'Attacking midfield' }],
    }))

    const [player] = await getSquad()
    expect(player.position).toBe('Midfielder')
  })

  it('handles an empty squad array', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: FCB_TEAM_ID, name: 'FC Barcelona', squad: [] }))

    const result = await getSquad()
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getMatches
// ---------------------------------------------------------------------------

describe('getMatches', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...OLD_ENV, FOOTBALL_DATA_API_KEY: 'test-key' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  const rawMatch = {
    id: 100,
    utcDate: '2025-09-01T19:00:00Z',
    status: 'FINISHED',
    competition: { id: 2014, name: 'La Liga' },
    homeTeam: { id: 81, name: 'FC Barcelona', crest: 'https://crests.football-data.org/81.png' },
    awayTeam: { id: 90, name: 'Real Madrid', crest: 'https://crests.football-data.org/90.png' },
    score: { fullTime: { home: 3, away: 1 } },
  }

  it('returns normalized match on success', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [rawMatch] }))

    const [match] = await getMatches(2025)
    expect(match.id).toBe(100)
    expect(match.homeTeam).toBe('FC Barcelona')
    expect(match.awayTeam).toBe('Real Madrid')
    expect(match.score).toBe('3-1')
    expect(match.status).toBe('FT')
    expect(match.competition).toBe('La Liga')
  })

  it('requests the correct URL including season param', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [] }))

    await getMatches(2025)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe(`${BASE_URL}/teams/${FCB_TEAM_ID}/matches?season=2025`)
  })

  it('returns empty array when matches is not an array', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: null }))

    expect(await getMatches(2025)).toEqual([])
  })

  it('returns empty array when matches key is missing', async () => {
    fetchMock.mockResolvedValue(okResponse({}))

    expect(await getMatches(2025)).toEqual([])
  })

  it('normalizes SCHEDULED status to NS', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'SCHEDULED', score: { fullTime: { home: null, away: null } } }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('NS')
  })

  it('normalizes TIMED status to NS', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'TIMED', score: { fullTime: { home: null, away: null } } }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('NS')
  })

  it('normalizes LIVE status to LIVE', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'LIVE' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('LIVE')
  })

  it('normalizes IN_PLAY status to LIVE', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'IN_PLAY' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('LIVE')
  })

  it('normalizes PAUSED status to LIVE', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'PAUSED' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('LIVE')
  })

  it('normalizes POSTPONED status to PP', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'POSTPONED' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('PP')
  })

  it('normalizes CANCELLED status to CANC', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'CANCELLED' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('CANC')
  })

  it('normalizes SUSPENDED status to SUSP', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'SUSPENDED' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('SUSP')
  })

  it('normalizes AWARDED status to AWD', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'AWARDED' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('AWD')
  })

  it('normalizes unknown status to NS (default fallback)', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, status: 'UNKNOWN_FUTURE_STATUS' }] }))

    const [m] = await getMatches(2025)
    expect(m.status).toBe('NS')
  })

  it('returns null score when home score is null', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, score: { fullTime: { home: null, away: 1 } } }] }))

    const [m] = await getMatches(2025)
    expect(m.score).toBeNull()
  })

  it('returns null score when away score is null', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, score: { fullTime: { home: 2, away: null } } }] }))

    const [m] = await getMatches(2025)
    expect(m.score).toBeNull()
  })

  it('returns null score when both scores are null', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, score: { fullTime: { home: null, away: null } } }] }))

    const [m] = await getMatches(2025)
    expect(m.score).toBeNull()
  })

  it('formats score as "home-away" string', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [{ ...rawMatch, score: { fullTime: { home: 0, away: 0 } } }] }))

    const [m] = await getMatches(2025)
    expect(m.score).toBe('0-0')
  })

  it('maps crest URLs correctly', async () => {
    fetchMock.mockResolvedValue(okResponse({ matches: [rawMatch] }))

    const [m] = await getMatches(2025)
    expect(m.homeTeamCrest).toBe('https://crests.football-data.org/81.png')
    expect(m.awayTeamCrest).toBe('https://crests.football-data.org/90.png')
  })

  it('falls back crest to null when missing', async () => {
    const matchNoCrest = { ...rawMatch, homeTeam: { id: 81, name: 'FC Barcelona', crest: null }, awayTeam: { id: 90, name: 'Real Madrid', crest: null } }
    fetchMock.mockResolvedValue(okResponse({ matches: [matchNoCrest] }))

    const [m] = await getMatches(2025)
    expect(m.homeTeamCrest).toBeNull()
    expect(m.awayTeamCrest).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getScorers
// ---------------------------------------------------------------------------

describe('getScorers', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...OLD_ENV, FOOTBALL_DATA_API_KEY: 'test-key' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  const rawScorer = {
    player: { id: 10, name: 'Lewandowski' },
    team: { id: 81, name: 'FC Barcelona', crest: null },
    goals: 25,
    assists: 5,
    playedMatches: 30,
  }

  it('returns mapped scorers on success', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [rawScorer] }))

    const [s] = await getScorers(LA_LIGA_COMPETITION_ID, 2025)
    expect(s.playerId).toBe(10)
    expect(s.playerName).toBe('Lewandowski')
    expect(s.goals).toBe(25)
    expect(s.assists).toBe(5)
    expect(s.playedMatches).toBe(30)
  })

  it('requests the correct URL', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [] }))

    await getScorers(2014, 2025)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe(`${BASE_URL}/competitions/2014/scorers?season=2025&limit=100`)
  })

  it('returns empty array when scorers is not an array', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: null }))

    expect(await getScorers(2014, 2025)).toEqual([])
  })

  it('defaults goals to 0 when null', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [{ ...rawScorer, goals: null }] }))

    const [s] = await getScorers(2014, 2025)
    expect(s.goals).toBe(0)
  })

  it('defaults assists to 0 when null', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [{ ...rawScorer, assists: null }] }))

    const [s] = await getScorers(2014, 2025)
    expect(s.assists).toBe(0)
  })

  it('defaults playedMatches to 0 when null', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [{ ...rawScorer, playedMatches: null }] }))

    const [s] = await getScorers(2014, 2025)
    expect(s.playedMatches).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getStandings
// ---------------------------------------------------------------------------

describe('getStandings', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...OLD_ENV, FOOTBALL_DATA_API_KEY: 'test-key' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  const rawRow = {
    position: 1,
    team: { id: 81, name: 'FC Barcelona', crest: 'https://crests.football-data.org/81.png' },
    playedGames: 10,
    won: 8,
    draw: 1,
    lost: 1,
    points: 25,
    goalsFor: 22,
    goalsAgainst: 8,
    goalDifference: 14,
  }

  it('returns normalized standings rows on success', async () => {
    fetchMock.mockResolvedValue(okResponse({
      standings: [{ type: 'TOTAL', table: [rawRow] }],
    }))

    const [row] = await getStandings(LA_LIGA_COMPETITION_ID, 2025)
    expect(row.position).toBe(1)
    expect(row.team.name).toBe('FC Barcelona')
    expect(row.points).toBe(25)
    expect(row.goalDifference).toBe(14)
  })

  it('requests the correct URL', async () => {
    fetchMock.mockResolvedValue(okResponse({ standings: [{ type: 'TOTAL', table: [rawRow] }] }))

    await getStandings(2014, 2025)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe(`${BASE_URL}/competitions/2014/standings?season=2025`)
  })

  it('picks the TOTAL entry when present', async () => {
    fetchMock.mockResolvedValue(okResponse({
      standings: [
        { type: 'HOME', table: [{ ...rawRow, position: 99 }] },
        { type: 'TOTAL', table: [rawRow] },
      ],
    }))

    const [row] = await getStandings(2014, 2025)
    expect(row.position).toBe(1)
  })

  it('falls back to the first entry when no TOTAL entry exists', async () => {
    fetchMock.mockResolvedValue(okResponse({
      standings: [
        { type: 'HOME', table: [{ ...rawRow, position: 5 }] },
        { type: 'AWAY', table: [{ ...rawRow, position: 7 }] },
      ],
    }))

    const [row] = await getStandings(2014, 2025)
    expect(row.position).toBe(5)
  })

  it('is case-insensitive for the TOTAL type field', async () => {
    fetchMock.mockResolvedValue(okResponse({
      standings: [{ type: 'total', table: [rawRow] }],
    }))

    const [row] = await getStandings(2014, 2025)
    expect(row.position).toBe(1)
  })

  it('returns empty array when standings is not an array', async () => {
    fetchMock.mockResolvedValue(okResponse({ standings: null }))

    expect(await getStandings(2014, 2025)).toEqual([])
  })

  it('returns empty array when standings array is empty', async () => {
    fetchMock.mockResolvedValue(okResponse({ standings: [] }))

    expect(await getStandings(2014, 2025)).toEqual([])
  })

  it('returns empty array when the chosen entry has no table array', async () => {
    fetchMock.mockResolvedValue(okResponse({ standings: [{ type: 'TOTAL' }] }))

    expect(await getStandings(2014, 2025)).toEqual([])
  })

  it('maps crest to null when missing from team', async () => {
    fetchMock.mockResolvedValue(okResponse({
      standings: [{ type: 'TOTAL', table: [{ ...rawRow, team: { id: 81, name: 'FC Barcelona', crest: null } }] }],
    }))

    const [row] = await getStandings(2014, 2025)
    expect(row.team.crest).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getTopScorers
// ---------------------------------------------------------------------------

describe('getTopScorers', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...OLD_ENV, FOOTBALL_DATA_API_KEY: 'test-key' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  const rawScorer = {
    player: { id: 10, name: 'Lewandowski' },
    team: { id: 81, name: 'FC Barcelona', crest: 'https://crests.football-data.org/81.png' },
    goals: 20,
    assists: 8,
    playedMatches: 25,
  }

  it('returns top scorers with team info on success', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [rawScorer] }))

    const [s] = await getTopScorers(LA_LIGA_COMPETITION_ID, 2025)
    expect(s.player.id).toBe(10)
    expect(s.player.name).toBe('Lewandowski')
    expect(s.team.name).toBe('FC Barcelona')
    expect(s.goals).toBe(20)
  })

  it('uses the default limit of 10', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [] }))

    await getTopScorers(2014, 2025)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('limit=10')
  })

  it('uses a custom limit when provided', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [] }))

    await getTopScorers(2014, 2025, 20)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('limit=20')
  })

  it('clamps limit to a minimum of 1', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [] }))

    await getTopScorers(2014, 2025, 0)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('limit=1')
  })

  it('clamps limit to a maximum of 100', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [] }))

    await getTopScorers(2014, 2025, 999)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('limit=100')
  })

  it('truncates a fractional limit to an integer', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [] }))

    await getTopScorers(2014, 2025, 7.9)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('limit=7')
  })

  it('returns empty array when scorers is not an array', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: null }))

    expect(await getTopScorers(2014, 2025)).toEqual([])
  })

  it('defaults goals to 0 when null', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [{ ...rawScorer, goals: null }] }))

    const [s] = await getTopScorers(2014, 2025)
    expect(s.goals).toBe(0)
  })

  it('defaults assists to 0 when null', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [{ ...rawScorer, assists: null }] }))

    const [s] = await getTopScorers(2014, 2025)
    expect(s.assists).toBe(0)
  })

  it('defaults team name to empty string when team is null', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [{ ...rawScorer, team: null }] }))

    const [s] = await getTopScorers(2014, 2025)
    expect(s.team.name).toBe('')
    expect(s.team.crest).toBeNull()
  })

  it('defaults team crest to null when team has no crest', async () => {
    fetchMock.mockResolvedValue(okResponse({ scorers: [{ ...rawScorer, team: { ...rawScorer.team, crest: null } }] }))

    const [s] = await getTopScorers(2014, 2025)
    expect(s.team.crest).toBeNull()
  })
})
