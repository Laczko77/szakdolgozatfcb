/**
 * Frontend client a dashboard widget preferenciák backend API-hoz — F30.
 *
 * Backend kontraktus (BE 26):
 *   GET  /api/dashboard-preferences        → { data: { widget_config, is_default } }
 *   PUT  /api/dashboard-preferences        → ugyanaz; body: { widget_config: [...] }
 *   POST /api/dashboard-preferences/reset  → ugyanaz; törli a row-t és visszaadja a default-ot
 *
 * A backend `successResponse(...)` a választ `{ data: ... }` envelope-be csomagolja,
 * ezért minden fetch helyer kicsomagolja a `body.data`-t.
 */

import type { WidgetConfigEntry } from "@/lib/constants/dashboard-widgets";

export type { WidgetConfigEntry };

export interface DashboardPreferencesResponse {
  widget_config: WidgetConfigEntry[];
  is_default: boolean;
}

interface Envelope<T> {
  data: T;
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

async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** GET /api/dashboard-preferences — sosem ad 404-et; ha nincs mentett konfig, default-ot ad. */
export async function fetchDashboardPreferences(
  signal?: AbortSignal,
): Promise<DashboardPreferencesResponse> {
  const res = await fetch("/api/dashboard-preferences", {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  const body = await jsonOrThrow<Envelope<DashboardPreferencesResponse>>(res);
  return body.data;
}

/** PUT /api/dashboard-preferences — teljes config payload mindig (a backend uniqe id+order-t vár). */
export async function saveDashboardPreferences(
  widget_config: WidgetConfigEntry[],
): Promise<DashboardPreferencesResponse> {
  const res = await fetch("/api/dashboard-preferences", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ widget_config }),
  });
  const body = await jsonOrThrow<Envelope<DashboardPreferencesResponse>>(res);
  return body.data;
}

/** POST /api/dashboard-preferences/reset — törli a felhasználói row-t és default-ot ad. */
export async function resetDashboardPreferences(): Promise<DashboardPreferencesResponse> {
  const res = await fetch("/api/dashboard-preferences/reset", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const body = await jsonOrThrow<Envelope<DashboardPreferencesResponse>>(res);
  return body.data;
}
