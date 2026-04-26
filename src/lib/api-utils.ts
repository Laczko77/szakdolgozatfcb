import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth'
import type { Profile } from '@/types/database'

/**
 * Utilities for App Router API route handlers (`src/app/api/**\/route.ts`).
 *
 * Auth guards return either an authenticated context object OR a NextResponse.
 * The NextResponse path is the short-circuit: callers `instanceof`-check the
 * result and return it directly.
 *
 * Usage:
 *
 *   export async function POST(request: NextRequest) {
 *     const guard = await requireAdminApi()
 *     if (guard instanceof NextResponse) return guard
 *     const { user, profile } = guard
 *     ...
 *   }
 */

export type AuthContext = {
  user: User
  profile: Profile
}

// ---------------------------------------------------------------------------
// Standard JSON response helpers
// ---------------------------------------------------------------------------

/**
 * Standard error envelope. Hungarian-language `message` is safe to display
 * to end users; structured codes go elsewhere if/when needed.
 */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Standard success envelope. Defaults to 200; pass 201 for resource creation.
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

// ---------------------------------------------------------------------------
// requireAuthApi
//
// Resolves to { user, profile } when a valid session exists, otherwise to a
// 401 NextResponse. Profile row is required: if auth.users exists but
// profiles is missing, treat it as a server-side data issue and return 500.
// ---------------------------------------------------------------------------
export async function requireAuthApi(): Promise<AuthContext | NextResponse> {
  const { user, profile } = await getCurrentUser()

  if (!user) {
    return errorResponse('Bejelentkezés szükséges', 401)
  }

  if (!profile) {
    // The handle_new_user trigger should make this impossible in practice;
    // if it happens, the profile row was deleted out-of-band.
    return errorResponse('Profil nem található', 500)
  }

  return { user, profile }
}

// ---------------------------------------------------------------------------
// requireAdminApi
//
// Same contract as requireAuthApi but additionally enforces admin role.
// Returns 401 for anonymous, 403 for authenticated non-admins.
// ---------------------------------------------------------------------------
export async function requireAdminApi(): Promise<AuthContext | NextResponse> {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard

  if (guard.profile.role !== 'admin') {
    return errorResponse('Admin jogosultság szükséges', 403)
  }

  return guard
}
