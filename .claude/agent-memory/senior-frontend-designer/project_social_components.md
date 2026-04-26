---
name: Social/community feed primitives (F11)
description: Reusable component primitives and helpers introduced for the F11 community feed at /kozosseg
type: project
---

The F11 community feed introduced a self-contained set of primitives under `src/components/social/`:

- **Avatar.tsx** — circular avatar with letter fallback, used in posts (40-42px) and comments (32px).
- **RelativeTime.tsx** — Hungarian relative timestamps ("most", "5 perce", "3 napja"), refreshes every 60s, SSR-safe (renders absolute date on first paint, swaps to relative after hydration).
- **ReactionBar.tsx** — universal reaction summary + popover picker; works for both `target_type='post'` and `target_type='comment'` via the `targetType` prop. The 6-emoji palette is exported as `REACTION_EMOJIS` from this file.
- **CommentItem.tsx** — single comment row with inline two-step delete confirmation.
- **CommentSection.tsx** — collapsible comment thread; manages its own comment list, own-reaction map, and composer state. Parent passes `authorCache` + `onResolveAuthors` so author profile lookups are deduped across the page.
- **PostCard.tsx** — feed post card with author header, body, optional image (lightbox-trigger), reactions, and a CommentSection.
- **NewPostComposer.tsx** — admin-only multipart post composer (POSTs to `/api/admin/posts`).
- **Lightbox.tsx** — fullscreen image overlay (portal to document.body), Escape-to-close, body-scroll-lock while open.

**Why:** these are composable enough to power Iteration F12+ (votes, dashboards) wherever a "card with author/timestamp/reaction-bar" pattern is needed.

**How to apply:**
- New social-style cards should reuse `Avatar`, `RelativeTime`, and `ReactionBar` rather than re-rolling them.
- For any new pollable feed surface, use `useFeedPolling` from `src/hooks/useFeedPolling.ts` — it handles `since`-cursor advancement, `document.visibilityState` gating, and in-flight coalescing.
- The shared helper types `EnrichedPost`, `EnrichedComment`, `AuthorSnapshot`, `OwnReaction`, `OwnReactionMap`, and `ownReactionKey()` live in `src/types/social.ts`.
- API client wrappers for posts/comments/reactions are in `src/lib/social-api.ts` (mirrors the `articles-api.ts` style: throw-on-non-2xx with the server message, callers toast).
