/**
 * Frontend client for the F22 / Backend Iteration 19 dream-team endpoints.
 *
 * Server-side response shapes (see src/app/api/dream-team/route.ts):
 *   GET    /api/dream-team        → { items: DreamTeam[] }              (raw)
 *   POST   /api/dream-team        → { data: DreamTeam }                 (envelope)
 *   GET    /api/dream-team/[id]   → DreamTeam                           (raw)
 *   PUT    /api/dream-team/[id]   → { data: DreamTeam }                 (envelope)
 *   DELETE /api/dream-team/[id]   → { success: true }                   (raw)
 *
 * The mixed envelopes are inherited from the existing route file — the
 * client unwraps both so the call sites only see the canonical type.
 */

import type {
  DreamTeam,
  DreamTeamFormation,
  DreamTeamPlayerSlot,
} from "@/types/database";

export interface DreamTeamPayload {
  name?: string;
  formation: DreamTeamFormation;
  players?: DreamTeamPlayerSlot[];
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

/** GET /api/dream-team — list all álomcsapatok of the caller (max 5). */
export async function fetchDreamTeams(): Promise<DreamTeam[]> {
  const response = await fetch("/api/dream-team", { cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = (await response.json()) as { items?: DreamTeam[] };
  return body.items ?? [];
}

/** GET /api/dream-team/[id] — fetch one álomcsapat (own only). */
export async function fetchDreamTeam(id: string): Promise<DreamTeam> {
  const response = await fetch(`/api/dream-team/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as DreamTeam;
}

/** POST /api/dream-team — create a new álomcsapat. */
export async function createDreamTeam(
  payload: DreamTeamPayload,
): Promise<DreamTeam> {
  const response = await fetch("/api/dream-team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = (await response.json()) as { data: DreamTeam };
  return body.data;
}

/** PUT /api/dream-team/[id] — partial update of name / formation / players. */
export async function updateDreamTeam(
  id: string,
  payload: Partial<DreamTeamPayload>,
): Promise<DreamTeam> {
  const response = await fetch(`/api/dream-team/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = (await response.json()) as { data: DreamTeam };
  return body.data;
}

/** DELETE /api/dream-team/[id] — remove. */
export async function deleteDreamTeam(id: string): Promise<void> {
  const response = await fetch(`/api/dream-team/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
}
