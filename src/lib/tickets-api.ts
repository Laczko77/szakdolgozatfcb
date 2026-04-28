/**
 * Frontend client for the F9 ticketing feature.
 *
 * Wraps the four Iteration 6 backend endpoints:
 *   - GET  /api/matches?scope=upcoming|past|all
 *   - GET  /api/matches/[id]      (match + sectors with availability)
 *   - GET  /api/tickets           (own upcoming/past tickets)
 *   - POST /api/tickets/purchase  (1..4 tickets, optional coupon)
 *
 * Mirrors the conventions in `lib/articles-api.ts`, `lib/shop-api.ts` and
 * `lib/dashboard-api.ts`: `cache: "no-store"`, server-provided error
 * messages re-thrown as Error, and explicit response shapes so the React
 * components only deal with typed data.
 */

import type { Match, MatchSector, Ticket } from "@/types/database";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * `MatchSector` decorated server-side with derived availability fields. The
 * `/api/matches/[id]` endpoint always returns this shape — the frontend
 * never has to recompute `available_seats` itself.
 */
export type SectorWithAvailability = MatchSector & {
  available_seats: number;
  is_sold_out: boolean;
};

export interface MatchDetail {
  match: Match;
  sectors: SectorWithAvailability[];
}

export interface MatchListResponse {
  matches: Match[];
}

/**
 * Ticket enriched with its sector and the sector's match — what
 * `/api/tickets` returns. The sector is nullable when the underlying
 * match was deleted out-of-band (RLS soft-delete scenario), so the
 * components must handle that gracefully.
 */
export type TicketWithRelations = Ticket & {
  sector: (MatchSector & { match: Match | null }) | null;
};

export interface MyTicketsResponse {
  upcoming: TicketWithRelations[];
  past: TicketWithRelations[];
}

export interface PurchaseRequest {
  match_id: string;
  sector_id: string;
  quantity: number;
  coupon_code?: string | null;
}

export interface PurchaseResponse {
  tickets: Ticket[];
  subtotal: number;
  total: number;
  coupon: { code: string; discount: number } | null;
  /** Set when the coupon failed but the tickets were still issued. */
  warning?: string;
}

export type MatchScope = "upcoming" | "past" | "all";

// ---------------------------------------------------------------------------
// Internal helpers
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

async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
 * List FC Barcelona matches. Defaults to `upcoming` so the listing page
 * lands on the most useful slice of data.
 */
export async function fetchMatches(
  options: { scope?: MatchScope; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Match[]> {
  const params = new URLSearchParams();
  params.set("scope", options.scope ?? "upcoming");
  if (options.limit) params.set("limit", String(options.limit));
  const data = await getJson<MatchListResponse>(
    `/api/matches?${params.toString()}`,
    signal,
  );
  return data.matches;
}

/**
 * Fetch the match detail page payload — match + all sectors enriched with
 * availability. Returns `null` when the match doesn't exist.
 */
export async function fetchMatchDetail(
  id: string,
  signal?: AbortSignal,
): Promise<MatchDetail | null> {
  try {
    return await getJson<MatchDetail>(`/api/matches/${id}`, signal);
  } catch (err) {
    // Re-throw aborts so the caller can ignore them; only swallow 404s.
    if (err instanceof Error && /404|nem található/i.test(err.message)) {
      return null;
    }
    throw err;
  }
}

/** The caller's own tickets, partitioned upcoming/past server-side. */
export async function fetchMyTickets(
  signal?: AbortSignal,
): Promise<MyTicketsResponse> {
  return getJson<MyTicketsResponse>("/api/tickets", signal);
}

/**
 * Buy 1..4 tickets in a single sector. The backend assigns seat numbers
 * contiguously inside a transaction, so the response always reflects the
 * true purchased seats — components should render whatever comes back
 * rather than echo the request quantity.
 *
 * Response shape note (F18.2 fix): `/api/tickets/purchase` uses the
 * shared `successResponse()` helper, which wraps the payload as
 * `{ data: { tickets, subtotal, total, coupon, warning? } }`. We unwrap
 * the envelope here so callers get the flat shape declared by
 * `PurchaseResponse`. The defensive guards (`?? []`, `Array.isArray`)
 * also protect against future server changes — if `tickets` ever comes
 * back malformed, we render an empty success state instead of crashing
 * the page with `TypeError: Cannot read properties of undefined`.
 */
export async function purchaseTickets(
  payload: PurchaseRequest,
  signal?: AbortSignal,
): Promise<PurchaseResponse> {
  const raw = await postJson<{ data?: PurchaseResponse } | PurchaseResponse>(
    "/api/tickets/purchase",
    payload,
    signal,
  );

  // Tolerate both the wrapped (`{ data: ... }`) and the legacy flat shape.
  const body =
    raw && typeof raw === "object" && "data" in raw && raw.data !== undefined
      ? (raw.data as PurchaseResponse)
      : (raw as PurchaseResponse);

  const tickets = Array.isArray(body?.tickets) ? body.tickets : [];

  return {
    tickets,
    subtotal: typeof body?.subtotal === "number" ? body.subtotal : 0,
    total: typeof body?.total === "number" ? body.total : 0,
    coupon: body?.coupon ?? null,
    warning: body?.warning,
  };
}
