---
name: Follow request approval flow (F26)
description: F26 reshaped follow into a request/approval lifecycle — three-state FollowButton, FollowRequestsPanel on /uzenetek, scroll-stable feed polling, public profile rewrite
type: project
---

F26 turned follow from an instant boolean into a three-state approval lifecycle and reorganised where follow CTAs appear.

**Why:** Backend Iteration 22 introduced pending follow requests (`POST /follow` no longer auto-accepts), an explicit accept/reject API for incoming requests, and `GET /api/users/suggested` + `GET /api/users/[id]/profile`. The frontend needed: a three-state button, a request inbox on the messages page, scroll-stable polling, and follow CTAs removed from feed cards (per UX feedback that they cluttered the timeline).

**How to apply when touching follow / community surfaces:**

- **`FollowStatus` is now `{ status: 'not_following' | 'pending' | 'following', isSelf?, isFollowedBy?, isMutual? }`.** The legacy `isFollowing: boolean` field is gone — `fetchFollowStatus()` synthesises `isMutual` for back-compat call-sites. ChatView still maps the conversation list's `is_following` flag into the new shape.
- **`FollowButton` (3-state):** gold "Követés" → muted clock "Kérelem elküldve" (disabled) → emerald "Követed" (click unfollows). Framer `layout` + AnimatePresence cross-fades the icon + label between states. Removed from `PostCard` and `ConversationListPanel` rows in F26.1 — those rows are now single-purpose links/buttons. Kept in `/profil/[id]`, `CommunityRightRail` (suggested fans), and `NewConversationModal`.
- **Where to follow someone:** the public profile (`/profil/[id]`) is the canonical surface. The "Új üzenet" search modal also offers per-row follow CTAs (`Követés kérése` / `Elküldve` / `Üzenet`) since it's the first place a user lands when looking up someone they don't follow yet.
- **`FollowRequestsPanel` (`src/components/social/FollowRequestsPanel.tsx`):** glass card mounted above the conversation list on `/kozosseg/uzenetek`. Calls `fetchFollowRequests()` on mount and on `refreshSignal` change. Each row is an emerald "Elfogad" + ghost-red "Elutasít" pair; rows AnimatePresence-exit on decision. Reports count via `onCountChange` so the parent can mirror it.
- **Üzenetek nav badge:** `CommunityLeftRail` re-fetches `fetchFollowRequests()` independently for an authenticated user and renders a red dot + numeric pill on the "Üzenetek" Nav item. Independent fetch (not lifted from the page) because the rail is sticky on `/kozosseg` where the messages page is not mounted.
- **Polling scroll-jump fix (F26.3):** `CommunityFeed.tsx` no longer prepends polled posts directly. New posts go into a `pendingPosts` buffer and a sticky "X új bejegyzés érkezett" banner offers to flush them. If `window.scrollY < 24` we treat the user as "watching the top" and merge inline. The banner click also `scrollIntoView`s a `feedTopRef` anchor so the freshly-merged post is in view. Authors + own-reactions are hydrated *while in the buffer* so the merge is instantaneous.
- **`/profil/[id]` (F26.2 rewrite):** uses new `fetchPublicProfile()` (`GET /api/users/[id]/profile`). Hero shows 88px avatar + username + join date + post count + admin pip. Below the hero: the user's 20 most recent posts via direct supabase-js query (no `/api/posts?author=` filter exists). 404 surface is an on-brand glass card with `Frown` icon + back link, never the Next default.
- **`fetchSuggestedUsers()`** powers `SuggestedFansCard` — backend filters self + already-followed itself; the widget just slices to 5. Empty-state copy: "Mindenkit ismersz már a közösségből."
- **Comment author (F26.8):** `EnrichedComment` now has optional `author?: AuthorSnapshot` because the backend joins it inline. `CommentSection` prefers `comment.author` over the lazy `authorCache` lookup. `CommentItem` fallback is "Ismeretlen szurkoló" (was "Vendég" — confused users since guests can't post).
- **`UserSearchResult.follow_status`:** the `/api/users/search` endpoint now ships `follow_status` per row, eliminating the per-result hydration round-trip. The modal still falls back to `fetchFollowStatus()` for any row missing it (defensive).
- **set-state-in-effect lint:** any synchronous setState pattern not yet inside an async IIFE must be wrapped in `queueMicrotask(() => setX(…))`. We hit it in `NewConversationModal` (reset-on-open + debounce-empty branch), `/profil/[id]` (notFound short-circuit), and `/uzenetek/page.tsx` (initial reload).
