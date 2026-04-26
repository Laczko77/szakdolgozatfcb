---
name: Auth UI primitives live in src/components/auth/
description: AuthShell + GlassField + PrimaryAuthButton + GoogleButton + ProtectedRoute + UserMenu are the reusable auth-flow primitives
type: project
---

The `src/components/auth/` directory holds the visual primitives composed by `/login` and `/register`:

- **`AuthShell.tsx`** — atmospheric backdrop (radial mesh + grid lattice + drifting orbs + SVG noise) plus the centred glass card frame. Use it for any future auth-adjacent pages (forgotten password, email verification, etc.).
- **`GlassField.tsx`** — glass-styled input with top-anchored uppercase label, password reveal toggle, error+hint slot. Don't use shadcn's `Input` for auth forms.
- **`PrimaryAuthButton.tsx`** — gradient-filled (blau→violet→grana) submit button with gold inner rim and hover shine sweep. Used as the final form CTA.
- **`GoogleButton.tsx`** — glass surface with the canonical 4-colour Google G mark inlined as SVG (no asset request).
- **`ProtectedRoute.tsx`** — client guard that redirects anon users to `/login?returnUrl=<pathname>` and renders `<LoadingScreen />` while auth hydrates. `adminOnly` prop exists for routes that need the role check on top.
- **`UserMenu.tsx`** — navbar avatar dropdown. Built from primitives (no Radix) for full control over glass styling. Replaces the previous inline avatar Link in Navbar.

**Why:** Iteration F4 needed both refined visual primitives and a reusable shell so future auth-related pages (password reset, email verify, etc.) match without re-inventing the design. Splitting the shell from the page bodies also keeps the page files focused on form logic.

**How to apply:**
- For forgotten-password / email-verify pages (likely F11+), reuse `<AuthShell />` and `<GlassField />`. Don't duplicate the backdrop.
- Form-level errors render inside the page (red-tinted banner above the first field), field-level errors render under the field via `GlassField`'s `error` prop.
- Supabase `AuthError` codes are translated to Hungarian via the per-page `mapAuthError()` helpers. If the same translation is needed in a third page, factor those out to `@/lib/auth-errors.ts`.
