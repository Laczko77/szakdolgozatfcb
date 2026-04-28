/**
 * Frontend client for the F19 La Liga widgets.
 *
 * Wraps `GET /api/standings` and `GET /api/scorers` with the same
 * conventions used by `lib/dashboard-api.ts` — `cache: "no-store"` on
 * the browser fetch (the backend already enforces a 1-hour Supabase
 * cache, so refreshes are cheap and let the user see edge updates).
 *
 * Note on type alignment with the backend:
 *  - Standings rows DO include `team.id` (we use it to highlight FCB).
 *  - Scorer rows do NOT — `getTopScorers()` in `lib/football-data.ts`
 *    drops it. We therefore highlight Barça scorers by team *name*.
 *    See FOOTBALL_DATA_BARCELONA_NAME below.
 */

// ---------------------------------------------------------------------------
// Public types — kept in sync with NormalizedStandingsRow / NormalizedTopScorer
// in `lib/football-data.ts`. Duplicated rather than re-exported so the
// frontend bundle does not pull in the football-data SDK module.
// ---------------------------------------------------------------------------

export interface StandingsRow {
  position: number;
  team: {
    id: number;
    name: string;
    crest: string | null;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface TopScorer {
  player: {
    id: number;
    name: string;
  };
  team: {
    name: string;
    crest: string | null;
  };
  goals: number;
  assists: number;
  playedMatches: number;
}

export interface StandingsResponse {
  standings: StandingsRow[];
  cached_at: string;
  season: number;
  stale?: boolean;
}

export interface TopScorersResponse {
  scorers: TopScorer[];
  cached_at: string;
  season: number;
  stale?: boolean;
}

/** football-data.org's id for FC Barcelona — used to highlight standings rows. */
export const FOOTBALL_DATA_BARCELONA_ID = 81;

/**
 * football-data.org's canonical team name for FC Barcelona.
 *
 * Used as the fallback highlight key for the scorers widget, where the
 * backend response intentionally does not expose `team.id`.
 */
export const FOOTBALL_DATA_BARCELONA_NAME = "FC Barcelona";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* fall through */
  }
  return `${response.status} ${response.statusText}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the La Liga table for the current season.
 *
 * Defaults to the current `competition=laliga&season=<currentStartYear>`.
 * The backend computes the season server-side when omitted, but the F19
 * spec calls for `season=2025` explicitly so the widget pins to the
 * 2025/26 campaign and doesn't drift across the New Year boundary.
 */
export async function fetchStandings(
  options: { season?: number } = {},
  signal?: AbortSignal,
): Promise<StandingsResponse> {
  const season = options.season ?? 2025;
  return getJson<StandingsResponse>(
    `/api/standings?competition=laliga&season=${season}`,
    signal,
  );
}

/**
 * Fetch the La Liga top scorers for the current season.
 *
 * `limit` defaults to 10 — that's the maximum the widget renders even
 * in its expanded state, so we never over-fetch.
 */
export async function fetchTopScorers(
  options: { season?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<TopScorersResponse> {
  const season = options.season ?? 2025;
  const limit = options.limit ?? 10;
  return getJson<TopScorersResponse>(
    `/api/scorers?competition=laliga&season=${season}&limit=${limit}`,
    signal,
  );
}
