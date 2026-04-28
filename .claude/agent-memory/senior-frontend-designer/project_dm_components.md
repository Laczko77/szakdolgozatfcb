---
name: DM + follow primitives (F23)
description: F23 community 3-col layout, DM panels, ChatView with Supabase Realtime, NewConversationModal, FollowButton, /profil/[id]
type: project
---

F23 introduced the DM hub and follow flow on top of the existing F11 community feed.

**Why:** Backend Iteration 18 shipped follows + conversations + messages + user search endpoints. The frontend needed a 3-column community page, a 2-panel DM hub with live updates, and a public profile route to host the FollowButton + DM CTA.

**How to apply:** When extending social/messaging features:

- **API client:** `src/lib/dm-api.ts` covers conversations, messages, users/search, follow toggle + status. `ApiError` (with `.status`) is the only re-thrown subclass — use it to detect `403` (mutual-follow rejection) and emit a friendly toast instead of the raw server message.
- **Types:** `src/types/dm.ts` exposes `EnrichedConversation` (matches GET /api/conversations shape — adds `otherUser`, `lastMessage`, `unreadCount`), `UserSearchResult`, `FollowStatus`.
- **Community shell:** `/kozosseg` is now a 3-col layout (`max-w-[1180px]`). Left rail (`CommunityLeftRail`) and right rail (`CommunityRightRail`) are `lg:flex` — hidden below 1024px. The feed itself was extracted into `CommunityFeed` so the page-level shell stays readable.
- **DM hub:** `/kozosseg/uzenetek` is a 2-panel desktop view (320px list + flex chat) keyed off `?c=<id>`. On `<md` it switches to a list-only view whose rows are `<Link>`s to `/kozosseg/uzenetek/[id]` (mobile detail route).
- **ChatView:** `subscribeToConversation` + optimistic send. Optimistic temp rows use `id: temp-<uuid>` and a `pending` flag for opacity dimming; `setMessages` dedupes by `id` so the realtime echo doesn't double-render. PUT /read fires on mount + after every inbound message from the other party. Day grouping via `Intl.DateTimeFormat` (Hu, "Ma" / "Tegnap" / long date).
- **NewConversationModal:** debounced (300ms) `searchUsers`. Each result fires a follow-status hydration in the background to render the "Kölcsönös követés" badge. Pick → `startConversation` → `403` triggers Hu toast "Előbb kövesd egymást, hogy üzenetet küldhess".
- **FollowButton:** optimistic toggle, hydrates `fetchFollowStatus` on mount, hides for self / guests. Calls `onStatusChange` so parents can react to mutual-follow transitions (e.g. enabling the "Üzenet" CTA on `/profil/[id]`).
- **Public profile:** `/profil/[id]/page.tsx` is a *minimal* surface — avatar + username + admin badge + FollowButton + DM CTA. Self-id redirects to `/profil`. Profile row hydrated client-side via supabase-js (RLS permits public SELECT). Avatar+name in `PostCard` author row now `<Link>` to this route.
- **"Online most" widget:** intentionally placeholder per the backlog — no real Presence. Uses a deterministic per-mount random count (24–68) plus 4 most-recent profiles as decorative avatars and the prefix "kb." to be honest about the placeholder nature.
- **`react-hooks/set-state-in-effect`:** every effect that needs to flip loading/data state wraps the work in an async IIFE so the synchronous setState happens *inside* the IIFE body, not the effect body itself.
