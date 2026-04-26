import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

/**
 * Server-side authentication helpers.
 *
 * Use these in Server Components, Server Actions, and Route Handlers.
 * NEVER import this module from a Client Component — it depends on the
 * cookie-bound server Supabase client.
 */

// ---------------------------------------------------------------------------
// getCurrentUser
//
// Returns both the auth user and the joined profile row in one call.
// `profile` may be null if the row was deleted out-of-band (e.g. admin tooling)
// even though the auth.users row still exists.
// ---------------------------------------------------------------------------
export async function getCurrentUser(): Promise<{
  user: User | null
  profile: Profile | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile: profile ?? null }
}

// ---------------------------------------------------------------------------
// isAdmin
//
// Lightweight boolean check. Returns false for anonymous users and for
// authenticated users whose profile row is missing or non-admin.
// ---------------------------------------------------------------------------
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Pick<Profile, 'role'>>()

  return profile?.role === 'admin'
}

// ---------------------------------------------------------------------------
// requireAdmin
//
// Use in Server Actions and admin-only Server Components. Throws on any
// failure — callers should let the error bubble up to Next.js's error
// boundary, which will render an error page (or, for actions, surface the
// failure to the client).
//
// API routes should prefer requireAdminApi() from `@/lib/api-utils` because
// it returns a NextResponse instead of throwing.
// ---------------------------------------------------------------------------
export async function requireAdmin(): Promise<{
  user: User
  profile: Profile
}> {
  const { user, profile } = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized: bejelentkezés szükséges')
  }

  if (!profile || profile.role !== 'admin') {
    throw new Error('Forbidden: admin jogosultság szükséges')
  }

  return { user, profile }
}

// ---------------------------------------------------------------------------
// getSession
//
// Lightweight session lookup (no profile join). Prefer getCurrentUser() when
// you need the profile row; this exists for cases where only the auth token
// matters (e.g. checking expiry).
// ---------------------------------------------------------------------------
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}
