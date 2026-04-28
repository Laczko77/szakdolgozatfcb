import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'

/**
 * /api/tracking/pageview
 *
 * POST — anonymous-friendly. Records a page (or product) view, but ONLY if
 * the supplied cookie_id has consented = true in cookie_consents.
 *
 * Body (JSON): {
 *   cookie_id:  string (UUID, required),
 *   page_path:  string (required, max 512 chars),
 *   product_id: string (UUID, optional)
 * }
 *
 * Behaviour:
 *   - Missing/invalid consent  -> 204 No Content (silent drop, GDPR-safe).
 *   - Logged-in user           -> user_id is auto-attached from the session.
 *   - Anonymous visitor        -> user_id is NULL.
 *
 * Writes use the service-role client because page_views has no end-user-
 * facing INSERT policy (admin-read-only by design).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_PATH_LEN = 512

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés tartalom', 400)
  }
  const obj = body as Record<string, unknown>

  if (typeof obj.cookie_id !== 'string' || !UUID_RE.test(obj.cookie_id)) {
    return errorResponse('A "cookie_id" mezőnek érvényes UUID-nak kell lennie', 400)
  }
  const cookieId = obj.cookie_id

  if (typeof obj.page_path !== 'string' || obj.page_path.trim().length === 0) {
    return errorResponse('A "page_path" mező kötelező', 400)
  }
  const pagePath = obj.page_path.trim().slice(0, MAX_PATH_LEN)

  let productId: string | null = null
  if (obj.product_id !== undefined && obj.product_id !== null) {
    if (typeof obj.product_id !== 'string' || !UUID_RE.test(obj.product_id)) {
      return errorResponse('A "product_id" mezőnek érvényes UUID-nak kell lennie', 400)
    }
    productId = obj.product_id
  }

  // Pull the (optional) authenticated user before switching to the service-role
  // client; createClient() is bound to the request's cookies, the service-role
  // client is not.
  const userClient = await createClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  const userId = user?.id ?? null

  const admin = createServiceRoleClient()

  // Consent gate. Silent drop on missing/declined consent so misconfigured
  // clients do not turn into a 4xx flood in the browser console.
  const { data: consent } = await admin
    .from('cookie_consents' as never)
    .select('consented')
    .eq('cookie_id', cookieId)
    .maybeSingle()

  if (!consent || (consent as { consented: boolean }).consented !== true) {
    return new NextResponse(null, { status: 204 })
  }

  const { error } = await admin.from('page_views').insert({
    user_id: userId,
    page_path: pagePath,
    product_id: productId,
    cookie_id: cookieId,
  } as never)

  if (error) {
    return errorResponse(
      `Oldalmegtekintés rögzítése sikertelen: ${error.message}`,
      500
    )
  }

  return new NextResponse(null, { status: 204 })
}
