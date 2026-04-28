---
name: Two post composers + FollowButton variants (F25)
description: User vs admin post composers and the variants of FollowButton across the social/DM surfaces
type: project
---

F25 split the community-feed composer in two and grew the FollowButton's contract to handle inline list-row use.

**Why:** Iteration F25 addressed three issues: (1) only admins could post; (2) the follow button surfaced no useful error when targeting a missing user; (3) the DM hub had no way to follow the partner inline. We also discovered the JOIN-ed author payload from the new /api/posts response can land in `EnrichedPost.author` and replace the lazy authorCache lookup.

**How to apply:**

- **Composers split:**
  - `NewPostComposer.tsx` → admin only, `POST /api/admin/posts` (multipart). Adds first-party broadcast posts.
  - `CreatePostForm.tsx` → any authenticated user, `POST /api/posts` (multipart). Click-to-expand glass card, react-hook-form + zod schema (max 2000 chars), drag-and-drop image dropzone with preview, Cancel/Publish actions. `CommunityFeed.tsx` picks one based on `isAdmin` (admin gets the original composer; non-admin users get the new one; guests get neither).
  - The user-facing API client lives in `lib/social-api.ts` as `createUserPost()`.

- **FollowButton variants:** `FollowButton` now accepts `initialStatus` (skips the on-mount hydration round-trip when the parent already has authoritative data — used by the conversation list rows that ship `is_following` inline) and `iconOnly` + `size: "xs" | "sm" | "md"` (icon-only collapses the label into aria-label/title — used by the conversation list rows). The button intentionally `e.stopPropagation()` + `e.preventDefault()` inside its own click handler so it's safe to nest visually inside a row that has its own click target.

- **Stretched-link row pattern:** `ConversationListPanel.ConvRow` previously wrapped the whole row in a `<Link>` / `<button>`. To layer a FollowButton inside the row without nesting interactive elements (invalid HTML), the row was restructured into a relative wrapper with an `absolute inset-0 z-0` stretched link/button beneath the visual content (`pointer-events-none` z-10) and the FollowButton lifted to `pointer-events-auto z-20`.

- **Error semantics in FollowButton:** `ApiError`-aware. `404` rolls back optimistic state and toasts "Felhasználó nem található"; `409` on a follow attempt keeps the "Követed" optimistic state (server-authoritative) and toasts "Már követed ezt a felhasználót"; everything else rolls back with the server message.

- **PostCard fallback rename:** `displayName` fallback changed from "FCB" to "Ismeretlen szurkoló". `PostCard` now reads `post.author ?? authorCache[author_id] ?? null` so the JOIN-ed author from the API takes precedence when present, and the lazy cache remains a safety net.

- **DM types:** `ProfileSnapshotWithFollow` extends `ProfileSnapshot` with optional `is_following` / `is_followed_by`. `EnrichedConversation.otherUser` is typed as the extended snapshot. `chatHeaderInitialStatus()` in `ChatView.tsx` translates these flags into a `FollowStatus` for the inline header button.
