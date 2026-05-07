/**
 * Frontend client for the F10 profile + global search backends
 * (Iteration 7).
 *
 * Mirrors the conventions in `lib/dashboard-api.ts`, `lib/coupons-api.ts`
 * and `lib/tickets-api.ts`:
 *   - `cache: "no-store"` so the user always sees fresh data.
 *   - Throws `Error` (server-provided message when present) on non-2xx.
 *
 * Endpoints (Backend Iteration 7):
 *   - GET  /api/profile             → caller's profile row
 *   - PUT  /api/profile             → multipart: username, avatar, remove_avatar
 *   - PUT  /api/profile/password    → JSON: current_password?, new_password
 *   - GET  /api/profile/purchases   → unified orders + tickets timeline
 *   - GET  /api/search?q=...        → grouped cross-table search
 */

import type {
  Article,
  Match,
  MatchSector,
  Order,
  OrderItem,
  Player,
  Post,
  Product,
  ProductVariant,
  Profile,
  Ticket,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Public types — purchases + search
// ---------------------------------------------------------------------------

export type OrderItemWithVariant = OrderItem & {
  variant:
    | (ProductVariant & {
        product: { id: string; name: string; image_url: string | null } | null;
      })
    | null;
};

export type OrderWithItems = Order & {
  items: OrderItemWithVariant[];
};

export type PurchasesTicket = Ticket & {
  sector: (MatchSector & { match: Match | null }) | null;
};

export type PurchasesTimelineEntry =
  | { type: "order"; timestamp: string; order: OrderWithItems }
  | { type: "ticket"; timestamp: string; ticket: PurchasesTicket };

export interface PurchasesResponse {
  timeline: PurchasesTimelineEntry[];
  orders: OrderWithItems[];
  tickets: PurchasesTicket[];
}

export interface SearchResults {
  query: string;
  articles: Article[];
  products: Product[];
  players: Player[];
  posts: Post[];
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* ignore */
  }
  return `${response.status} ${response.statusText}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API — profile reads
// ---------------------------------------------------------------------------

export async function fetchProfile(signal?: AbortSignal): Promise<Profile> {
  const body = await getJson<{ data: Profile }>("/api/profile", signal);
  return body.data;
}

export async function fetchPurchases(
  signal?: AbortSignal,
): Promise<PurchasesResponse> {
  return getJson<PurchasesResponse>("/api/profile/purchases", signal);
}

// ---------------------------------------------------------------------------
// Public API — profile mutations
// ---------------------------------------------------------------------------

export interface UpdateProfileArgs {
  username?: string | null;
  avatar?: File | null;
  removeAvatar?: boolean;
}

/**
 * Multipart `PUT /api/profile`. The backend accepts a partial update — pass
 * only the fields you want to change. `username` may be `null` to clear it,
 * `avatar` is a freshly selected `File`, and `removeAvatar: true` deletes
 * the existing one without uploading a replacement.
 */
export async function updateProfile(
  args: UpdateProfileArgs,
): Promise<Profile> {
  const form = new FormData();

  if (typeof args.username === "string" || args.username === null) {
    form.append("username", args.username ?? "");
  }
  if (args.avatar instanceof File) {
    form.append("avatar", args.avatar);
  }
  if (args.removeAvatar) {
    form.append("remove_avatar", "true");
  }

  const res = await fetch("/api/profile", {
    method: "PUT",
    body: form,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const body = (await res.json()) as { data: Profile };
  return body.data;
}

export interface ChangePasswordArgs {
  currentPassword?: string;
  newPassword: string;
}

export async function changePassword({
  currentPassword,
  newPassword,
}: ChangePasswordArgs): Promise<{ updated: true }> {
  const res = await fetch("/api/profile/password", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...(currentPassword ? { current_password: currentPassword } : {}),
      new_password: newPassword,
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const body = (await res.json()) as { data: { updated: true } };
  return body.data;
}

// ---------------------------------------------------------------------------
// Public API — global search
// ---------------------------------------------------------------------------

/**
 * Cross-table search. Backend treats <2 char queries as empty.
 * Returns well-formed empty groups for short / blank queries — callers
 * don't need a special-case branch.
 */
export async function searchAll(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<SearchResults> {
  const params = new URLSearchParams({ q: query });
  if (options.limit) params.set("limit", String(options.limit));
  return getJson<SearchResults>(`/api/search?${params}`, options.signal);
}
