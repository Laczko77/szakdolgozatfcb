import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use this in Server Components, Route Handlers, and Server Actions.
 *
 * The set/remove handlers may throw when called from a Server Component
 * (cookies are read-only there); we swallow that error because session
 * refresh is handled by the middleware.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — ignore. Middleware refreshes the session.
          }
        },
      },
    }
  )
}

/**
 * Service-role client for privileged operations (admin tasks, cron jobs).
 * NEVER expose this to the browser. Bypasses RLS.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // no-op: service role client is stateless
        },
      },
    }
  )
}
