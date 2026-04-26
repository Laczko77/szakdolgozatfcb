/**
 * Frontend client for the Iteration 9 polls + points endpoints.
 *
 * All helpers mirror the conventions in {@link dashboard-api.ts}:
 *   - `cache: "no-store"` so vote counts always reflect reality.
 *   - Server-provided error message thrown as `Error` on non-2xx.
 *   - AbortSignal pass-through for component unmounts.
 *
 * The list endpoint already enriches each poll with:
 *   - `results` — per-option vote counts (Record<number, number>)
 *   - `total_votes` — sum of all results
 *   - `user_vote` — the caller's selected_option, or null
 * so the UI can render every state from a single round-trip.
 */

import type { Poll } from "@/types/database";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface EnrichedPoll extends Poll {
  results: Record<number, number>;
  total_votes: number;
  user_vote: number | null;
}

interface PollsListResponse {
  polls: EnrichedPoll[];
}

interface VoteResponse {
  data: {
    id: string;
    poll_id: string;
    user_id: string;
    selected_option: number;
    created_at: string;
  };
}

export type PollStatus = "active" | "resolved" | "all";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* noop */
  }
  return `${response.status} ${response.statusText}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the full poll list. Use `status: "active"` to power the dashboard
 * widget and `status: "all"` for the public listing.
 */
export async function fetchPolls(
  options: { status?: PollStatus; matchId?: string } = {},
  signal?: AbortSignal,
): Promise<EnrichedPoll[]> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.matchId) params.set("match_id", options.matchId);
  const qs = params.toString();
  const url = qs ? `/api/polls?${qs}` : "/api/polls";

  const data = await getJson<PollsListResponse>(url, signal);
  return data.polls;
}

/**
 * Cast a single vote. The server returns 409 if the user already voted —
 * the caller should treat that as a "stale UI" condition and refetch.
 */
export async function castVote(
  pollId: string,
  selectedOption: number,
): Promise<VoteResponse["data"]> {
  const res = await fetch(`/api/polls/${pollId}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ selected_option: selectedOption }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const body = (await res.json()) as VoteResponse;
  return body.data;
}
