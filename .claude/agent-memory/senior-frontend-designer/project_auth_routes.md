---
name: Auth routes are /login and /register, returnUrl param convention
description: Auth pages live at /login and /register; both ?returnUrl= and ?redirect= are accepted for post-auth navigation
type: project
---

Auth pages: `src/app/login/page.tsx` and `src/app/register/page.tsx`. The middleware (`src/middleware.ts`) redirects unauthenticated `/admin/*` access to `/login?redirect=...`, while the client-side `<ProtectedRoute />` wrapper uses `?returnUrl=...`. Both query params are honoured by the login/register pages, defaulting to `/dashboard`.

**Why:** Backlog F4 specifies `/login` and `/register`. The middleware was already using `/login`+`?redirect=`. To keep both naming styles compatible and prevent breaking the middleware-driven redirect path, both query params are accepted.

**How to apply:**
- Don't introduce a third query-param name. Pick `?returnUrl=` for new client redirects.
- Always run user-supplied URLs through the `safeReturnUrl()` helper (only allows same-origin paths starting with `/`, rejects `//`).
- The previous `/belepes` link in `CTASection.tsx` and `Navbar.tsx` was retired — there is no `/belepes` route. All auth links now point to `/login` or `/register`.
- Google OAuth redirect goes to `/auth/callback?next=<returnUrl>` — that route handler is part of the backend's responsibility (Backend Iteration 2). If it does not exist yet, the OAuth flow will land on Supabase's default callback.
