/**
 * Frontend-shaped types for the F11 community feed.
 *
 * The server (/api/posts, /api/posts/[id]/comments) enriches base
 * Post / Comment rows with aggregated reaction counts and (for posts)
 * comment counts. We keep those shapes named here so components can
 * import a single canonical type.
 */

import type { Post, Comment, Profile } from "@/types/database";

export interface EnrichedPost extends Post {
  /** Per-emoji reaction count, e.g. { "❤️": 3, "🔥": 1 }. */
  reactions: Record<string, number>;
  reactionTotal: number;
  commentCount: number;
  /**
   * F25.1 — optional author snapshot returned by the backend JOIN. When
   * present, the feed UI prefers this over the lazy `authorCache` lookup
   * so the author's username + avatar render in the very first paint.
   */
  author?: AuthorSnapshot | null;
}

export interface EnrichedComment extends Comment {
  reactions: Record<string, number>;
  reactionTotal: number;
}

/** Lightweight profile snapshot displayed alongside posts/comments. */
export interface AuthorSnapshot {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: Profile["role"];
}

/**
 * Locally-tracked "the current user reacted with this emoji" state.
 *
 * The /api/posts response does NOT include the caller's own reaction id
 * (it's a public endpoint), so we look it up lazily via Supabase the
 * first time the feed renders for an authenticated user, and cache the
 * result here keyed by `${target_type}:${target_id}`.
 */
export interface OwnReaction {
  /** The DB row id — needed for DELETE /api/reactions/[id]. */
  id: string;
  emoji: string;
}

export type OwnReactionMap = Record<string, OwnReaction | undefined>;

export function ownReactionKey(
  targetType: "post" | "comment",
  targetId: string,
): string {
  return `${targetType}:${targetId}`;
}
