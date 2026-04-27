---
name: Global error and 404 pages
description: src/app/not-found.tsx and src/app/error.tsx provide the project-wide 404 and runtime-error fallbacks; both reuse the glass design system
type: project
---

`src/app/not-found.tsx` and `src/app/error.tsx` are the canonical app-wide fallbacks added in F16.9.

- `not-found.tsx` is server-rendered; triggered by any unmatched route OR by any server component that calls `notFound()` (e.g. `/hirek/[id]`, `/jatekosok/[id]`, `/shop/[id]` already do this for missing rows).
- `error.tsx` is a Client Component (Next.js requires it). Receives `{ error, reset }` and offers a Retry that calls `reset()` plus a Home link as ultimate fallback. Logs `error` to the console on mount.

**Why:** In F16 we needed a calm, on-brand fallback rather than the default Next.js error page; both files use `glass-card-strong`, the gradient halos from the landing hero, and Bebas Neue display type so they read as part of the portal, not a system page.

**How to apply:** Don't add per-route `not-found.tsx` files unless a section needs a more specific fallback — the global one already covers everything. If a future iteration wires Sentry or another crash reporter, the place to add `Sentry.captureException(error)` is inside the `useEffect` in `src/app/error.tsx`.
