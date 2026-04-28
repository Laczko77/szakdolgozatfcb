---
name: Vercel deployment readiness
description: Build errors fixed for Vercel deployment, known issues and env vars required
type: project
---

Build was broken in three ways before deployment prep (2026-04-28):

1. TypeScript error in `src/app/api/admin/analytics/products/route.ts` — `productRows` typed as `never` due to earlier `as never` cast on same supabase client. Fixed by adding explicit `ProductRow` local type and casting `productRows as ProductRow[]`.

2. TypeScript error in `src/app/api/tracking/pageview/route.ts` — `cookie_consents` table not in generated types, so `consent.consented` was typed as `never`. Fixed by casting the from() call `as never` and the result to `{ consented: boolean }`.

3. `/login` and `/register` pages used `useSearchParams()` without a `<Suspense>` boundary — Next.js 16 requires this for static prerendering. Fixed by introducing an outer shell component + `<Suspense>` wrapper and moving all logic to an `*Inner` component.

**Why:** Next.js 16 enforces Suspense wrapping for `useSearchParams()` at build time, not just runtime. This is a breaking change vs older versions.

**How to apply:** Any new page that calls `useSearchParams()` must wrap the inner component in `<Suspense>`. Pattern: outer `export default` returns `<Suspense fallback={...}><InnerComponent /></Suspense>`.

`vercel.json` created at repo root — sets `maxDuration: 60` for the two sync endpoints (`/api/admin/matches/sync` and `/api/admin/players/sync`) which call football-data.org and may exceed Vercel's default 15s function timeout.

Required environment variables for Vercel (all must be set in project settings):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_DATA_API_KEY`
