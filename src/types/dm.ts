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

export interface EnrichedConversation extends Conversation {
  otherUser: ProfileSnapshot | null;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface UserSearchResult extends ProfileSnapshot {
  /** Filled in lazily by the client after a follow-status lookup. */
  isMutual?: boolean;
}

export interface FollowStatus {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
  isSelf?: boolean;
}
