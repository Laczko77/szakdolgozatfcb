/**
 * Frontend-shaped types for the F23 DM + follow feature.
 *
 * The conversations endpoint enriches the base {@link Conversation} row
 * with the other participant's public profile, the last message, and the
 * caller's unread counter — so a single GET powers the entire list view.
 */

import type { Conversation, Message, Profile } from "@/types/database";

export type ProfileSnapshot = Pick<
  Profile,
  "id" | "username" | "avatar_url"
>;

/**
 * F25.4 — extended snapshot used inside the conversation list. The DM
 * endpoint now returns `is_following` for the other participant so the
 * frontend can render the inline follow toggle without an extra round
 * trip per row.
 */
export interface ProfileSnapshotWithFollow extends ProfileSnapshot {
  is_following?: boolean;
  is_followed_by?: boolean;
}

export interface EnrichedConversation extends Conversation {
  otherUser: ProfileSnapshotWithFollow | null;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface UserSearchResult extends ProfileSnapshot {
  /** Filled in lazily by the client after a follow-status lookup. */
  isMutual?: boolean;
  /**
   * F26.7 — the search endpoint now hydrates a follow-status string for
   * each row so the client can render the appropriate CTA without a
   * per-result round-trip. Optional because we keep the legacy
   * `isMutual` lookup path alive as a fallback.
   */
  follow_status?: FollowStatusKind;
}

/**
 * F26.4 — three-state follow lifecycle.
 *
 * The backend now models follow as a request/approval flow:
 *   - `not_following` — caller has no relationship to the target.
 *   - `pending`       — caller has sent a follow request that the
 *                       target has not yet accepted.
 *   - `following`     — request accepted, caller is following.
 *
 * The legacy `FollowStatus` shape (boolean trio + isSelf) is retained
 * as `LegacyFollowStatus` so non-DM call-sites that read mutual-follow
 * still compile until they're migrated.
 */
export type FollowStatusKind = "not_following" | "pending" | "following";

export interface FollowStatus {
  status: FollowStatusKind;
  /** True when the target is the caller — UI should hide follow CTAs. */
  isSelf?: boolean;
  /** True when the target follows the caller (used for mutual-only DM gates). */
  isFollowedBy?: boolean;
  /** Convenience: true iff status==='following' && isFollowedBy. */
  isMutual?: boolean;
}

/**
 * F26.5 — incoming follow-request row used by the Üzenetek "Követési
 * kérelmek" panel. The backend strips the request down to its essence:
 * the request id (used by accept/reject) and the requesting user's
 * public profile snapshot.
 */
export interface FollowRequest {
  id: string;
  follower: ProfileSnapshot;
  created_at?: string;
}

/**
 * F26.6 — suggestion card payload. Identical shape to a profile
 * snapshot; named for readability at the call-site.
 */
export type SuggestedUser = ProfileSnapshot;
