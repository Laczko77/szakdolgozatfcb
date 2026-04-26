---
name: News component primitives (F6)
description: Component set introduced in Iteration F6 for the public news listing and article detail pages
type: project
---

F6 ships these reusable primitives under `src/components/news/`:
- `CategoryPills` — horizontally scrollable filter pills, `layoutId="news-category-pill-bg"` (distinct from shop's `category-filter-bg`)
- `HeroArticle` / `HeroArticleSkeleton` — asymmetric 60/40 broadsheet hero (image left, copy right) for the lead story
- `ArticleCard` / `ArticleCardSkeleton` / `ArticleGridSkeleton` — glass card mirroring ProductCard dimensions; 16:10 image well
- `ArticleContent` — plain-text body renderer with first-paragraph drop-cap (`first-letter:` Tailwind), splits paragraphs on blank lines
- `RelatedArticles` — server-rendered 3-card rail (no Framer Motion, CSS hover only)
- `NewsEmptyState` — "no articles" / "empty filter" with one-click reset

Data layer: `src/lib/articles-api.ts` (`fetchArticles`, `fetchArticle`) — same shape as `shop-api.ts`, `cache: "no-store"` to keep admin posts fresh.

Article detail (`src/app/hirek/[id]/page.tsx`) is a Server Component — calls Supabase via `createClient()` directly + `generateMetadata` for OG tags. The listing (`src/app/hirek/page.tsx`) is a Client Component wrapped in Suspense (required for `useSearchParams`).

**Why:** The /hirek detail page is content-heavy and SEO-relevant; SSR avoids client-side flash and produces real HTML for crawlers. The listing needs filter/pagination interactivity, so it stays client-side.

**How to apply:** Reuse these primitives for any future article-style content (e.g., admin news preview, dashboard "Legfrissebb hírek" widget). When a new news view needs the same hero, use `HeroArticle`. When a detail page needs prose typography, use `ArticleContent`.
