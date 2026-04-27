---
name: Admin panel architecture (F15)
description: Admin panel uses hand-rolled primitives (NOT shadcn/ui), pathname-guarded public chrome, AdminShell wrapper
type: project
---

The /admin/* surface ships its own primitives under `src/components/admin/*` (AdminCard, AdminButton, AdminTable, AdminDialog, AdminInput, AdminSelect, AdminBadge, ImageDropzone, ConfirmDialog, Pagination, AdminShell, AdminSidebar, AdminTopBar). Tiptap rich-text editor lives at `src/components/admin/articles/TiptapEditor.tsx` with styles scoped under `.tiptap-editor` in globals.css.

**Why hand-rolled instead of shadcn/ui:** the shadcn primitives in `src/components/ui/*` reference theme tokens (--background, --primary, --muted-foreground, etc.) that are NOT defined in this Tailwind v4 setup. The project's design tokens are --bg-primary, --text-primary, --accent-gold, etc. Wiring shadcn's tokens was out of scope, so admin uses the existing tokens directly.

**Public chrome opt-out:** Navbar, MobileHeader, Footer, BottomTabBar, and CookieBanner each early-return when `pathname.startsWith("/admin")`. CartDrawer / CommandPalette stay mounted (they're invisible by default and only open on user trigger).

**How to apply:** When adding new /admin routes, just create the page — AdminShell layout (`src/app/admin/layout.tsx`) wraps it automatically. Use the admin/* primitives, not shadcn/ui or the glass utilities. The middleware already gates non-admins; AdminShell adds a client-side guard for mid-session role flips.

The admin reviews list endpoint `GET /api/admin/reviews` was created here (F15.10) — backend originally only shipped `PUT /api/admin/reviews/[id]`. Returns ALL reviews (visible+hidden) joined with product and profile, with a `visibility` filter param.

**Admin client-side fetch helper (`src/lib/admin-fetch.ts`):** wraps the inconsistent admin-API response shapes — `successResponse()` envelope is `{ data: T }`, but a handful of older endpoints (GET `/api/admin/coupons`, GET `/api/posts`, GET `/api/posts/[id]/comments`, GET `/api/polls`) return raw top-level shapes like `{ coupons }` / `{ posts }` / `{ polls }`. Use `adminFetch<T>()` for the standard envelope; switch to `adminFetchRaw<T>()` for the raw-shape endpoints. Errors surface as `AdminApiError` with `status` and `message`.

**F15.5–F15.9, F15.11 pages** (each in `src/app/admin/<slug>/page.tsx`): meccsek, jatekosok, posztok, szavazasok, kuponok, analitika. All use the AbortController + queueMicrotask load pattern (matches existing rendelesek/cikkek/etc style). Charts (analitika) use Recharts horizontal BarChart with `var(--accent-gold)` fill and `var(--glass-border)` grid lines so they pick up theme changes automatically.
