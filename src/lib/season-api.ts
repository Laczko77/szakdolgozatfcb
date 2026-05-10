/**
 * Frontend client for the F31 La Liga Season Story page.
 *
 * Wraps the four `/api/season/...` endpoints introduced in Backend Iter 27:
 *   - GET /api/season/standings-evolution
 *   - GET /api/season/team-form
 *   - GET /api/season/scorers-snapshot
 *   - GET /api/season/match/[id]
 *
 * All four go through `getJson()` with `cache: "no-store"` — the backend
 * already enforces multi-hour Supabase caches per route, so refreshes on
 * the client are cheap and let the page show edge updates immediately.
 *
 * Type contracts mirror the route handlers' response shapes; we duplicate
 * them rather than re-export to keep the football-data.org SDK module out
 * of the client bundle.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MatchdaySnapshotTeam {
  team_id: number;
  team_name: string;
  points: number;
  goal_difference: number;
  position: number;
}

export interface MatchdaySnapshot {
  matchday: number;
  teams: MatchdaySnapshotTeam[];
}

export interface StandingsEvolutionResponse {
  evolution: MatchdaySnapshot[];
  cached_at: string;
  season: number;
  competition_id: number;
  stale?: boolean;
}

export interface FormMatch {
  match_id: number;
  utcDate: string;
  matchday: number | null;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: { home: number; away: number };
  result: "W" | "D" | "L";
}

export interface TeamFormResponse {
  team_id: number;
  matches: FormMatch[];
  cached_at: string;
  season: number;
  competition_id: number;
  stale?: boolean;
}

export interface ScorerSnapshot {
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

export interface ScorersSnapshotResponse {
  scorers: ScorerSnapshot[];
  cached_at: string;
  season: number;
  competition_id: number;
  evolution_supported: false;
  stale?: boolean;
}

export type MatchStatus =
  | "FT"
  | "AWD"
  | "LIVE"
  | "IN_PLAY"
  | "PAUSED"
  | "TIMED"
  | "SCHEDULED"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | "FINISHED";

export interface MatchDetailsGoal {
  minute: number;
  scorer: { id: number; name: string };
  team: { id: number; name: string };
  type?: string | null;
}

export interface MatchDetailsBooking {
  minute: number;
  player: { id: number; name: string };
  team: { id: number; name: string };
  card: "YELLOW" | "RED" | "YELLOW_RED" | string;
}

export interface MatchDetailsSubstitution {
  minute: number;
  team: { id: number; name: string };
  playerOut: { id: number; name: string };
  playerIn: { id: number; name: string };
}

/**
 * Per-team box score returned by Sofascore for finished matches.
 * Every numeric field is independently nullable — the upstream provider
 * may report some metrics and omit others, so each row in the UI has to
 * tolerate `null` ("—") without breaking the layout.
 */
export interface TeamStatSnapshot {
  /** 0-100 percent. */
  possession: number | null;
  shots: number | null;
  shots_on_target: number | null;
  corners: number | null;
  fouls: number | null;
  /** 0-100 percent. */
  pass_accuracy: number | null;
}

export interface MatchTeamStats {
  home: TeamStatSnapshot;
  away: TeamStatSnapshot;
}

// ---------------------------------------------------------------------------
// Sofascore-sourced extras (added in BE iter 28).
//
// All four payloads are independent — `data_quality === "partial"` means at
// least one of them is missing while the others may still be present, so
// every UI section has to fall back gracefully on its own.
// ---------------------------------------------------------------------------

export interface SofascoreLineupPlayer {
  id: number;
  name: string;
  jerseyNumber: number | null;
  /** "G" | "D" | "M" | "F" — Sofascore's coarse position bucket. */
  position: string | null;
  substitute: boolean;
  stats: {
    rating: number | null;
    minutesPlayed: number | null;
    goals: number | null;
    assists: number | null;
    yellowCard: boolean;
    redCard: boolean;
    saves: number | null;
    totalPass: number | null;
    accuratePass: number | null;
  };
}

export interface SofascoreLineupsPayload {
  confirmed: boolean;
  /** Stylised formation string, e.g. "4-3-3". */
  homeFormation: string | null;
  awayFormation: string | null;
  home: SofascoreLineupPlayer[];
  away: SofascoreLineupPlayer[];
}

export interface SofascoreIncident {
  /** "goal" | "card" | "substitution" | "varDecision" | "period" | string */
  type: string;
  time: number;
  addedTime: number | null;
  isHome: boolean | null;
  playerName: string | null;
  playerInName: string | null;
  playerOutName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  cardType: string | null;
  goalType: string | null;
  description: string | null;
}

export interface SofascoireShotmapEntry {
  playerId: number | null;
  playerName: string | null;
  isHome: boolean;
  /** "goal" | "save" | "miss" | "post" | "block" */
  shotType: string;
  bodyPart: string | null;
  situation: string | null;
  xg: number | null;
  /** Raw 0-100 pitch coordinates as Sofascore reports them. */
  playerCoordinates: { x: number; y: number } | null;
  goalMouthCoordinates: { x: number; y: number } | null;
}

export interface SofascoreGraphPoint {
  minute: number;
  /** -100 (full home pressure) ... +100 (full away pressure). */
  value: number;
}

export interface SofascoireBestPlayers {
  home: { id: number; name: string; rating: number | null } | null;
  away: { id: number; name: string; rating: number | null } | null;
}

export interface MatchDetailsResponse {
  match: {
    id: number;
    utcDate: string;
    status: MatchStatus;
    homeTeam: { id: number; name: string; crest?: string | null };
    awayTeam: { id: number; name: string; crest?: string | null };
    score: { home: number | null; away: number | null };
  };
  events: {
    goals: MatchDetailsGoal[];
    bookings: MatchDetailsBooking[];
    substitutions: MatchDetailsSubstitution[];
  };
  /**
   * Aggregate team statistics for finished matches. `null` when:
   *  - the match isn't FT yet, or
   *  - Sofascore didn't return a stats payload.
   */
  team_stats: MatchTeamStats | null;
  /** Sofascore lineups payload (kickoff XI + bench). `null` when unavailable. */
  lineups: SofascoreLineupsPayload | null;
  /** Sofascore incident timeline (goals, cards, subs, VAR, period markers). */
  incidents: SofascoreIncident[];
  /** Per-shot map with optional xG and pitch coordinates. */
  shotmap: SofascoireShotmapEntry[];
  /** Per-minute momentum points (-100..+100). */
  graph: SofascoreGraphPoint[];
  /** Sofascore "man of the match" picks per side. */
  best_players: SofascoireBestPlayers | null;
  data_quality: "full" | "partial" | "unavailable";
  cached_at: string;
  stale?: boolean;
}

/** football-data.org canonical IDs — same constants the backend uses. */
export const FCB_TEAM_ID = 81;
export const LA_LIGA_COMPETITION_ID = 2014;

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

export interface FetchSeasonOptions {
  competition?: number;
  season?: number;
}

/** Cumulative La Liga table per matchday for the requested season. */
export async function fetchStandingsEvolution(
  { competition = LA_LIGA_COMPETITION_ID, season }: FetchSeasonOptions = {},
  signal?: AbortSignal,
): Promise<StandingsEvolutionResponse> {
  const params = new URLSearchParams({ competition: String(competition) });
  if (season) params.set("season", String(season));
  return getJson<StandingsEvolutionResponse>(
    `/api/season/standings-evolution?${params.toString()}`,
    signal,
  );
}

/** Last 10 finished La Liga matches for a team (default = FCB). */
export async function fetchTeamForm(
  options: FetchSeasonOptions & { teamId?: number } = {},
  signal?: AbortSignal,
): Promise<TeamFormResponse> {
  const {
    competition = LA_LIGA_COMPETITION_ID,
    season,
    teamId = FCB_TEAM_ID,
  } = options;
  const params = new URLSearchParams({
    competition: String(competition),
    team_id: String(teamId),
  });
  if (season) params.set("season", String(season));
  return getJson<TeamFormResponse>(
    `/api/season/team-form?${params.toString()}`,
    signal,
  );
}

/** Top-N scorers snapshot. `evolution_supported` is always false (free tier). */
export async function fetchScorersSnapshot(
  options: FetchSeasonOptions & { limit?: number } = {},
  signal?: AbortSignal,
): Promise<ScorersSnapshotResponse> {
  const {
    competition = LA_LIGA_COMPETITION_ID,
    season,
    limit = 10,
  } = options;
  const params = new URLSearchParams({
    competition: String(competition),
    limit: String(limit),
  });
  if (season) params.set("season", String(season));
  return getJson<ScorersSnapshotResponse>(
    `/api/season/scorers-snapshot?${params.toString()}`,
    signal,
  );
}

/** Detailed event timeline for a single match (cached pass-through). */
export async function fetchMatchDetails(
  matchId: number,
  signal?: AbortSignal,
): Promise<MatchDetailsResponse> {
  return getJson<MatchDetailsResponse>(
    `/api/season/match/${matchId}`,
    signal,
  );
}

// ---------------------------------------------------------------------------
// Derived helpers — used by /season page components
// ---------------------------------------------------------------------------

/**
 * Build a per-matchday series for a single team out of the snapshot list.
 * Returns `[{ matchday, points, goal_difference, position }]` sorted by md.
 */
export function teamPointsSeries(
  evolution: MatchdaySnapshot[],
  teamId: number,
): Array<{
  matchday: number;
  points: number;
  goal_difference: number;
  position: number;
}> {
  const result: Array<{
    matchday: number;
    points: number;
    goal_difference: number;
    position: number;
  }> = [];
  for (const snap of evolution) {
    const row = snap.teams.find((t) => t.team_id === teamId);
    if (!row) continue;
    result.push({
      matchday: snap.matchday,
      points: row.points,
      goal_difference: row.goal_difference,
      position: row.position,
    });
  }
  return result;
}

/**
 * Pick the team that finished second on the last available matchday.
 * Falls back to `null` when the evolution is empty.
 */
export function pickRunnerUp(
  evolution: MatchdaySnapshot[],
  excludeTeamId: number,
): MatchdaySnapshotTeam | null {
  if (evolution.length === 0) return null;
  const last = evolution[evolution.length - 1];
  // Prefer team at position 2; if that's the excluded team, take position 1
  // — i.e. when FCB themselves are 2nd, the comparator becomes the leader.
  const sorted = [...last.teams].sort((a, b) => a.position - b.position);
  for (const t of sorted) {
    if (t.team_id !== excludeTeamId) return t;
  }
  return null;
}

/** Tally W/D/L counts from a team-form response. */
export function tallyForm(matches: FormMatch[]): {
  wins: number;
  draws: number;
  losses: number;
} {
  const out = { wins: 0, draws: 0, losses: 0 };
  for (const m of matches) {
    if (m.result === "W") out.wins += 1;
    else if (m.result === "D") out.draws += 1;
    else out.losses += 1;
  }
  return out;
}
