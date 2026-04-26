import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'

/**
 * PUT /api/profile/password
 *
 * Authenticated. Changes the caller's password via Supabase Auth's
 * `updateUser({ password })`. Supabase enforces the minimum length policy
 * configured in the project; we add a defense-in-depth check (>= 8) and
 * an optional `current_password` re-verification.
 *
 * Body: JSON
 *   - new_password:     string (required, >= 8 chars)
 *   - current_password: string (optional but recommended; used to
 *                       re-authenticate before changing the password)
 */

const MIN_PASSWORD_LENGTH = 8

export async function PUT(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés tartalom', 400)
  }
  const payload = body as Record<string, unknown>

  const newPassword = payload.new_password
  const currentPassword = payload.current_password

  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return errorResponse(
      `Az új jelszónak legalább ${MIN_PASSWORD_LENGTH} karakter hosszúnak kell lennie`,
      400
    )
  }

  const supabase = await createClient()

  // Optional re-verification with the current password. We try only when the
  // caller supplied one — Supabase Auth itself does not require it for
  // updateUser, but most products expect it for a password change UX.
  if (typeof currentPassword === 'string' && currentPassword.length > 0) {
    if (!user.email) {
      return errorResponse(
        'A fiókhoz nem tartozik email — jelenlegi jelszó ellenőrzése nem lehetséges',
        400
      )
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) {
      return errorResponse('A jelenlegi jelszó nem helyes', 401)
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return errorResponse(`Jelszó módosítása sikertelen: ${error.message}`, 400)
  }

  return successResponse({ updated: true })
}
