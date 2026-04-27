/**
 * Frontend client for the F7 player endpoints.
 *
 * Mirrors the shape of `lib/articles-api.ts`: every helper throws on
 * non-2xx with the server-provided error message so callers can `catch`
 * and surface it via the toast system.
 *
 * Server routes:
 *   GET /api/players?position=&season=
 *   GET /api/players/[id]
 *
 * The shape of the `stats` JSONB column is fixed by the admin sync route
 * (`src/app/api/admin/players/sync/route.ts`) — we mirror it here so the
 * UI never has to defend against missing keys at the call site.
 */

import type { Player } from "@/types/database";
import type { PlayerPosition } from "@/lib/constants";

/**
 * Canonical stats payload written by the admin sync. All keys are present
 * (zero-filled when the API returns null), but we still type each field
 * as `number | undefined` because the JSONB column is typed `Json` in the
 * database row, so TypeScript can't statically guarantee anything.
 */
export interface PlayerStats {
  goals?: number;
  assists?: number;
  appearances?: number;
  minutes?: number;
  yellow_cards?: number;
  red_cards?: number;
}

export interface PlayerListResponse {
  players: Player[];
}

interface FetchPlayersParams {
  position?: PlayerPosition;
  season?: number;
  signal?: AbortSignal;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // fall through
  }
  return `${response.status} ${response.statusText}`;
}

/**
 * Pull the squad. Server returns the rows already sorted (GK → DEF → MID → ATT,
 * jersey number ascending), so the client doesn't need to re-sort.
 */
export async function fetchPlayers(
  params: FetchPlayersParams = {},
): Promise<Player[]> {
  const url = `/api/players${buildQuery({
    position: params.position,
    season: params.season,
  })}`;

  const response = await fetch(url, {
    signal: params.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as PlayerListResponse;
  return data.players;
}

/**
 * Fetch a single player by primary key. 404s become a thrown error with
 * the server-provided message so the caller can render a not-found UI.
 */
export async function fetchPlayer(id: string): Promise<Player> {
  const response = await fetch(`/api/players/${id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as Player;
}

/**
 * Narrow the loose `Json` type on `Player.stats` into our canonical
 * stats shape. Any unexpected payload returns an empty object — the UI
 * then renders zeroes rather than crashing.
 */
export function readPlayerStats(stats: Player["stats"]): PlayerStats {
  if (stats === null || typeof stats !== "object" || Array.isArray(stats)) {
    return {};
  }
  const record = stats as Record<string, unknown>;
  const num = (key: string): number | undefined => {
    const v = record[key];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };
  return {
    goals: num("goals"),
    assists: num("assists"),
    appearances: num("appearances"),
    minutes: num("minutes"),
    yellow_cards: num("yellow_cards"),
    red_cards: num("red_cards"),
  };
}
