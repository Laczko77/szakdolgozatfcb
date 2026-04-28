/**
 * Frontend client for the F11 community-feed endpoints.
 *
 * Mirrors `lib/articles-api.ts` — every function throws on non-2xx with
 * the server-provided error message so callers can `catch` and surface
 * via the toast system.
 *
 * Server routes:
 *   GET    /api/posts?since=&page=&limit=
 *   GET    /api/posts/[id]/comments
 *   POST   /api/posts/[id]/comments
 *   DELETE /api/comments/[id]
 *   POST   /api/reactions
 *   DELETE /api/reactions/[id]
 *   POST   /api/admin/posts            (multipart)
 */

import type { Comment, Reaction, ReactionTarget } from "@/types/database";
import type { EnrichedComment, EnrichedPost } from "@/types/social";

export interface PostListResponse {
  posts: EnrichedPost[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CommentListResponse {
  comments: EnrichedComment[];
  total: number;
}

interface FetchPostsParams {
  page?: number;
  limit?: number;
  /** ISO timestamp — only return posts created at-or-after this moment. */
  since?: string;
  signal?: AbortSignal;
}

function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
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
    // Fall through to status text.
  }
  return `${response.status} ${response.statusText}`;
}

/* ------------------------------------------------------------------ */
/* Posts                                                              */
/* ------------------------------------------------------------------ */

export async function fetchPosts(
  params: FetchPostsParams = {},
): Promise<PostListResponse> {
  const url = `/api/posts${buildQuery({
    page: params.page,
    limit: params.limit,
    since: params.since,
  })}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: params.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PostListResponse;
}

/* ------------------------------------------------------------------ */
/* Comments                                                           */
/* ------------------------------------------------------------------ */

export async function fetchComments(
  postId: string,
  init?: { signal?: AbortSignal },
): Promise<CommentListResponse> {
  const response = await fetch(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: init?.signal,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as CommentListResponse;
}

export async function createComment(
  postId: string,
  content: string,
): Promise<Comment> {
  const response = await fetch(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  // requireAuthApi returns the row directly (not wrapped), see successResponse.
  return (await response.json()) as Comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const response = await fetch(
    `/api/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE", headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

/* ------------------------------------------------------------------ */
/* Reactions                                                          */
/* ------------------------------------------------------------------ */

export interface UpsertReactionPayload {
  target_type: ReactionTarget;
  target_id: string;
  emoji: string;
}

/**
 * POST /api/reactions
 *
 * The server treats this as upsert-or-swap semantics: if the caller
 * already reacted to this target, it updates the emoji in place
 * (preserving the row id) so the DELETE route stays valid.
 */
export async function upsertReaction(
  payload: UpsertReactionPayload,
): Promise<Reaction> {
  const response = await fetch(`/api/reactions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  // successResponse wraps the row in { data: Reaction }
  const body = (await response.json()) as { data: Reaction };
  return body.data;
}

export async function deleteReaction(reactionId: string): Promise<void> {
  const response = await fetch(
    `/api/reactions/${encodeURIComponent(reactionId)}`,
    { method: "DELETE", headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

/* ------------------------------------------------------------------ */
/* User composer (F25.3)                                              */
/* ------------------------------------------------------------------ */

/**
 * POST /api/posts (multipart/form-data).
 *
 * Public user-facing endpoint introduced in backlog 21.3 — any
 * authenticated user can publish to the community feed. The route is
 * deliberately separate from /api/admin/posts so the admin composer's
 * elevated permissions (e.g. pin / moderation flags) can diverge later
 * without breaking this surface.
 */
export async function createUserPost(input: {
  content: string;
  image?: File | null;
}): Promise<EnrichedPost> {
  const fd = new FormData();
  fd.append("content", input.content);
  if (input.image) fd.append("image", input.image);

  const response = await fetch(`/api/posts`, {
    method: "POST",
    body: fd,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  // The endpoint returns the raw row; the feed expects enrichment
  // fields, so we synthesise zeroed counters here.
  const post = (await response.json()) as EnrichedPost;
  return {
    ...post,
    reactions: post.reactions ?? {},
    reactionTotal: post.reactionTotal ?? 0,
    commentCount: post.commentCount ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Admin composer                                                     */
/* ------------------------------------------------------------------ */

/**
 * POST /api/admin/posts (multipart/form-data).
 *
 * Server expects `content` (required) and an optional `image` File. We
 * skip the JSON wrapper here on purpose — multipart is required so the
 * upload pipeline can stream the file straight into the storage bucket.
 */
export async function createAdminPost(input: {
  content: string;
  image?: File | null;
}): Promise<EnrichedPost> {
  const fd = new FormData();
  fd.append("content", input.content);
  if (input.image) fd.append("image", input.image);

  const response = await fetch(`/api/admin/posts`, {
    method: "POST",
    body: fd,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  // The admin endpoint returns the raw row; the feed expects enrichment
  // fields, so we synthesise zeroed counters here.
  const post = (await response.json()) as EnrichedPost;
  return {
    ...post,
    reactions: post.reactions ?? {},
    reactionTotal: post.reactionTotal ?? 0,
    commentCount: post.commentCount ?? 0,
  };
}

export async function deleteAdminPost(postId: string): Promise<void> {
  const response = await fetch(
    `/api/admin/posts/${encodeURIComponent(postId)}`,
    { method: "DELETE", headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
