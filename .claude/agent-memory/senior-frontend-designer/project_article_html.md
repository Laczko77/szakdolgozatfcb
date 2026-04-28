---
name: Articles store HTML, render via DOMPurify + .fcb-prose
description: articles.content is Tiptap HTML; render through isomorphic-dompurify and the hand-rolled .fcb-prose stylesheet, never raw
type: project
---

Since F15 the admin panel ships a Tiptap editor that persists
`articles.content` as HTML (`<p>`, `<h2>`, `<strong>`, `<a>`, lists).
F18.4 fixed the public side so that markup is no longer rendered as
literal text.

**Pipeline:**
- **Detail body** (`/hirek/[id]`) — `<ArticleContent content={...} />`
  detects HTML via a tag-list regex, sanitises with `DOMPurify.sanitize`
  using a whitelist (`p, br, strong, em, a, ul, ol, li, h1..h4,
  blockquote, code, pre, hr, img`) and injects via
  `dangerouslySetInnerHTML`. Plain-text legacy articles still use the
  paragraph-split + drop-cap fallback in the same component.
- **Excerpts** (cards, OG description, search) — `htmlExcerpt(html, n)`
  in `src/lib/html-excerpt.ts` strips all tags, decodes basic entities,
  and word-boundary clips. Used by `ArticleCard`, `HeroArticle`,
  `generateMetadata` in the detail page.
- **Styling** — hand-rolled `.fcb-prose` class in `globals.css` (NOT
  `@tailwindcss/typography`). Speaks the project's `--text-primary`,
  `--accent-gold`, `--glass-border` tokens, drop-cap on first paragraph,
  gold-marker lists, gold-bar blockquotes, monospace code on
  `--glass-bg-strong`.

**Why:** The plugin's stock prose look fights the liquid-glass aesthetic
and would force purple/blue defaults. The custom stylesheet keeps the
editorial reading column on-brand.

**How to apply:** Any new surface that renders article content (search
results, RSS, e-mail digests) must use `htmlExcerpt()` for short
summaries and `<ArticleContent>` (or another `.fcb-prose` block with
DOMPurify) for full bodies. Never `dangerouslySetInnerHTML` raw HTML
from Supabase — always sanitise first.
