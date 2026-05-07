import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * OAuth / magic-link callback (PKCE flow).
 *
 * Flow:
 *   1. Read `code` from the query string.
 *   2. Exchange it for a session (sets cookies via the SSR helper).
 *   3. Detect duplicate-email collisions between providers (e.g. user
 *      already signed up with email/password and now tries Google with
 *      the same address). Because Supabase creates a *separate* auth.users
 *      row per provider by default, we delete the freshly-created Google
 *      row and redirect back to /login with an explanatory error.
 *   4. Validate `next` (only same-origin relative paths) and redirect.
 *
 * Errors always redirect to /login?error=... — never expose server stacks.
 */

/** Whitelist for the `next` redirect target. Same-origin relative paths only. */
function safeNext(raw: string | null): string {
  if (!raw) return '/'
  // Must start with a single '/' and not '//' (protocol-relative) or '/\'
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const origin = url.origin

  // No code → invalid callback hit (user navigated here directly, or the
  // OAuth provider returned an error). Bounce to login.
  if (!code) {
    const errorDescription = url.searchParams.get('error_description')
    const target = new URL('/login', origin)
    target.searchParams.set('error', errorDescription ? 'oauth_error' : 'auth_failed')
    return NextResponse.redirect(target)
  }

  const supabase = await createClient()

  // ── 1. Exchange the code for a session ────────────────────────────────
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !exchangeData.user) {
    const target = new URL('/login', origin)
    target.searchParams.set('error', 'auth_failed')
    return NextResponse.redirect(target)
  }

  const signedInUser = exchangeData.user
  const signedInEmail = signedInUser.email?.toLowerCase() ?? null

  // ── 2. Account-merging guard ──────────────────────────────────────────
  // If there is *another* auth.users row with the same email (different
  // provider, different user_id), we have a collision. Roll back the new
  // OAuth user and ask the visitor to sign in with their original method.
  if (signedInEmail) {
    try {
      const admin = createServiceRoleClient()
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      })

      const sameEmailUsers = (list?.users ?? []).filter(
        (u) => u.email?.toLowerCase() === signedInEmail,
      )

      // More than one auth.users row shares this email → collision.
      if (sameEmailUsers.length > 1) {
        // Identify the *older* account (the one the user originally created).
        // Sort ascending by created_at; the freshly-created OAuth row is the
        // newest one, which is also the currently-signed-in user.
        const sorted = [...sameEmailUsers].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        const newest = sorted[sorted.length - 1]

        // Defensive: only delete if the newest row matches the user we just
        // signed in, otherwise we'd nuke the wrong account.
        if (newest && newest.id === signedInUser.id) {
          // Sign out the browser session first so the user lands on /login
          // without a half-broken cookie set.
          await supabase.auth.signOut()
          // Service-role hard delete — cascade removes the empty profiles row
          // (FK ON DELETE CASCADE on profiles.id → auth.users.id).
          await admin.auth.admin.deleteUser(newest.id)
        }

        const target = new URL('/login', origin)
        target.searchParams.set('error', 'email_exists')
        target.searchParams.set('email', signedInEmail)
        return NextResponse.redirect(target)
      }
    } catch {
      // listUsers / deleteUser failure must NOT block legitimate logins.
      // Worst case: a duplicate row survives; we log nothing client-side.
      // Continue to the redirect below.
    }
  }

  // ── 3. Success → go to the requested next URL ─────────────────────────
  return NextResponse.redirect(new URL(next, origin))
}
