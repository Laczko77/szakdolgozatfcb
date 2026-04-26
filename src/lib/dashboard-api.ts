/**
 * Frontend client for the F5 dashboard widgets.
 *
 * The dashboard composes several pre-existing endpoints into a single
 * "daily hub" view — it doesn't have a dedicated `/api/dashboard` route.
 * Every fetch helper here defers to the canonical endpoint owned by the
 * relevant backend module (matches / articles / orders / points).
 *
 * Mirrors the conventions in `lib/articles-api.ts` and `lib/shop-api.ts`:
 * `cache: "no-store"` so the user always sees fresh data, and a thrown
 * Error with the server-provided message on non-2xx responses.
 */

import type {
  Article,
  Match,
  PointTransaction,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface UpcomingMatchesResponse {
  matches: Match[];
}

interface ArticlesPagedResponse {
  articles: Article[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PointsResponse {
  balance: { balance: number; total_earned: number };
  transactions: PointTransaction[];
}

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
 * Fetch the next upcoming FCB match — the dashboard only ever shows one,
 * but the endpoint returns a list, so we slice. Returns `null` when there
 * is no scheduled match.
 */
export async function fetchNextMatch(
  signal?: AbortSignal,
): Promise<Match | null> {
  const data = await getJson<UpcomingMatchesResponse>(
    "/api/matches?scope=upcoming&limit=1",
    signal,
  );
  return data.matches[0] ?? null;
}

/**
 * Fetch the three newest articles for the "Legfrissebb hírek" widget.
 * Mirrors the behaviour of the public news listing without paging.
 */
export async function fetchLatestArticles(
  signal?: AbortSignal,
): Promise<Article[]> {
  const data = await getJson<ArticlesPagedResponse>(
    "/api/articles?page=1&limit=3",
    signal,
  );
  return data.articles;
}

/**
 * Fetch the caller's point balance + transaction history. Auth-guarded
 * server-side via {@link requireAuthApi}.
 */
export async function fetchPoints(signal?: AbortSignal): Promise<PointsResponse> {
  return getJson<PointsResponse>("/api/profile/points", signal);
}
