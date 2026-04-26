import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/**
 * Root middleware.
 *
 * Responsibilities:
 *   1. Refresh the Supabase auth session cookie on every request (so server
 *      components see a valid session).
 *   2. Guard /admin/* routes — redirect anonymous users to /login and
 *      non-admins to /.
 *
 * Edge-runtime compatible: uses only @supabase/ssr + Next.js request/response
 * APIs (no `next/headers`, no Node built-ins).
 */
export async function middleware(request: NextRequest) {
  // Build a mutable response that we will hand back at the end. The Supabase
  // client may rotate the auth cookie; we forward those rotations via this
  // response object.
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() must run between createServerClient and the response,
  // otherwise the auth token may not refresh and users will be silently
  // logged out. This is a documented @supabase/ssr requirement.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ---------------------------------------------------------------------------
  // Admin route guard
  // ---------------------------------------------------------------------------
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    // Not signed in → /login (preserve original target via ?redirect=)
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Signed in but not admin → home page
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<{ role: 'user' | 'admin' }>()

    if (!profile || profile.role !== 'admin') {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      homeUrl.searchParams.delete('redirect')
      return NextResponse.redirect(homeUrl)
    }
  }

  return response
}

/**
 * Run the middleware on every request EXCEPT static assets and the favicon.
 * Image optimisation routes (`_next/image`) and build artefacts (`_next/static`)
 * never need session refresh and excluding them keeps p95 latency low.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
