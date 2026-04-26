---
name: AuthProvider is the canonical auth state source
description: Client auth state lives in src/providers/AuthProvider.tsx; useAuthUser is a thin legacy wrapper around useAuth
type: project
---

`<AuthProvider />` (mounted in `src/app/layout.tsx` between `ThemeProvider` and `ToastProvider`) is the single source of truth for browser-side auth state. It exposes `{ user, session, profile, isAdmin, isLoading, signOut, refreshProfile }` via `useAuth()`.

**Why:** Iteration F4 introduced the auth UI. Before F4, components used the lightweight `useAuthUser` hook which only knew about `user`/`loading`. The provider was added to give components a single hook for `profile.role` (admin checks) and `signOut()` without each consumer re-subscribing to `onAuthStateChange`.

**How to apply:**
- New components: import `useAuth` from `@/providers/AuthProvider`. Don't import the Supabase browser client to read auth state — go through the context.
- The legacy `useAuthUser()` hook still exists but is now a one-line wrapper around `useAuth()`. Don't delete it (other agents may still call it), but prefer `useAuth()` in new code.
- `signOut()` from the context already calls `router.refresh()` + `router.push("/")`, so callers should not duplicate that.
- The provider only refetches the `profiles` row when the user **id** changes, not on every token refresh.
