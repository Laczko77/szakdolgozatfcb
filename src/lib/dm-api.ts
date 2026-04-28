/**
 * Frontend client for the F23 DM + follow endpoints.
 *
 * Conventions mirror {@link dashboard-api.ts}:
 *   - `cache: "no-store"` so unread counters and messages stay fresh.
 *   - Server-provided `error` message rethrown as `Error` on non-2xx.
 *   - AbortSignal pass-through so React effects can cancel.
 *
 * The conversations list endpoint returns rows enriched with the other
 * participant's profile, the last message, and the caller's unread
 * counter — see /api/conversations for the canonical shape.
 */

import type { Conversation, Message } from "@/types/database";
import type {
  EnrichedConversation,
  FollowRequest,
  FollowStatus,
  SuggestedUser,
  UserSearchResult,
} from "@/types/dm";
import type { Profile } from "@/types/database";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface ConversationsResponse {
  conversations: EnrichedConversation[];
}
interface ConversationResponse {
  conversation: Conversation;
}
interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}
interface SendMessageResponse {
  message: Message;
}
interface UsersSearchResponse {
  users: UserSearchResult[];
}
interface ReadResponse {
  updated: number;
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
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

/** POST helper that surfaces the server error verbatim and includes the status code on the thrown Error. */
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function fetchConversations(
  signal?: AbortSignal,
): Promise<EnrichedConversation[]> {
  const data = await getJson<ConversationsResponse>(
    "/api/conversations",
    signal,
  );
  return data.conversations;
}

/**
 * Start a new DM thread (or fetch the existing one) with `targetUserId`.
 * The endpoint enforces mutual follow — `403` is the meaningful error
 * the caller wants to differentiate.
 */
export async function startConversation(
  targetUserId: string,
  signal?: AbortSignal,
): Promise<Conversation> {
  const data = await postJson<ConversationResponse>(
    "/api/conversations",
    { targetUserId },
    signal,
  );
  return data.conversation;
}

export async function fetchMessages(
  conversationId: string,
  options: { before?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  if (options.before) params.set("before", options.before);
  if (options.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  const url = `/api/conversations/${encodeURIComponent(conversationId)}/messages${
    qs ? `?${qs}` : ""
  }`;
  return getJson<MessagesResponse>(url, signal);
}

export async function sendMessage(
  conversationId: string,
  content: string,
  signal?: AbortSignal,
): Promise<Message> {
  const data = await postJson<SendMessageResponse>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    { content },
    signal,
  );
  return data.message;
}

export async function markConversationRead(
  conversationId: string,
  signal?: AbortSignal,
): Promise<number> {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/read`,
    {
      method: "PUT",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status);
  }
  const body = (await res.json()) as ReadResponse;
  return body.updated;
}

// ---------------------------------------------------------------------------
// Users + follow
// ---------------------------------------------------------------------------

export async function searchUsers(
  q: string,
  signal?: AbortSignal,
): Promise<UserSearchResult[]> {
  if (q.trim().length < 2) return [];
  const url = `/api/users/search?q=${encodeURIComponent(q.trim())}`;
  const data = await getJson<UsersSearchResponse>(url, signal);
  return data.users;
}

/**
 * F26.4 — the backend now returns
 *   { status: 'not_following' | 'pending' | 'following',
 *     isSelf?: boolean, isFollowedBy?: boolean }
 *
 * For backwards compatibility with older /profil/[id] code-paths that
 * still read the legacy boolean trio, we synthesise `isMutual` here.
 */
export async function fetchFollowStatus(
  userId: string,
  signal?: AbortSignal,
): Promise<FollowStatus> {
  const raw = await getJson<FollowStatus>(
    `/api/users/${encodeURIComponent(userId)}/follow-status`,
    signal,
  );
  return {
    ...raw,
    isMutual:
      (raw.status === "following" && (raw.isFollowedBy ?? false)) || false,
  };
}

export async function followUser(
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  await postJson<{ success: true }>(
    `/api/users/${encodeURIComponent(userId)}/follow`,
    {},
    signal,
  );
}

export async function unfollowUser(
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `/api/users/${encodeURIComponent(userId)}/follow`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status);
  }
}

// ---------------------------------------------------------------------------
// F26.5 — Incoming follow requests
// ---------------------------------------------------------------------------

interface FollowRequestsResponse {
  requests: FollowRequest[];
}

export async function fetchFollowRequests(
  signal?: AbortSignal,
): Promise<FollowRequest[]> {
  // The endpoint is allowed to return either a bare array or a wrapped
  // envelope — accept both so a backend tweak later doesn't break us.
  const res = await fetch("/api/follow-requests", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new ApiError(await readErrorMessage(res), res.status);
  const body = (await res.json()) as FollowRequest[] | FollowRequestsResponse;
  return Array.isArray(body) ? body : body.requests;
}

async function mutateFollowRequest(
  requestId: string,
  action: "accept" | "reject",
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `/api/follow-requests/${encodeURIComponent(requestId)}/${action}`,
    {
      method: "PUT",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (!res.ok) throw new ApiError(await readErrorMessage(res), res.status);
}

export async function acceptFollowRequest(
  requestId: string,
  signal?: AbortSignal,
): Promise<void> {
  return mutateFollowRequest(requestId, "accept", signal);
}

export async function rejectFollowRequest(
  requestId: string,
  signal?: AbortSignal,
): Promise<void> {
  return mutateFollowRequest(requestId, "reject", signal);
}

// ---------------------------------------------------------------------------
// F26.6 — Suggested users
// ---------------------------------------------------------------------------

interface SuggestedUsersResponse {
  users: SuggestedUser[];
}

export async function fetchSuggestedUsers(
  signal?: AbortSignal,
): Promise<SuggestedUser[]> {
  const res = await fetch("/api/users/suggested", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new ApiError(await readErrorMessage(res), res.status);
  const body = (await res.json()) as SuggestedUser[] | SuggestedUsersResponse;
  return Array.isArray(body) ? body : body.users;
}

// ---------------------------------------------------------------------------
// F26.2 — Public profile
// ---------------------------------------------------------------------------

export interface PublicProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  post_count: number;
  role?: Profile["role"];
}

export async function fetchPublicProfile(
  userId: string,
  signal?: AbortSignal,
): Promise<PublicProfile | null> {
  const res = await fetch(
    `/api/users/${encodeURIComponent(userId)}/profile`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(await readErrorMessage(res), res.status);
  const body = (await res.json()) as
    | PublicProfile
    | { profile: PublicProfile };
  return "profile" in body ? body.profile : body;
}

// Re-export so callers can `instanceof` differentiate 403 (mutual missing).
export { ApiError };
