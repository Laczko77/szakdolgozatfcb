import { type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse, successResponse } from '@/lib/api-utils'

/**
 * /api/consent
 *
 * POST — anonymous-friendly. Records a GDPR cookie-consent decision.
 *
 * Body (JSON): { cookie_id?: string (UUID), consented: boolean }
 *
 * If cookie_id is omitted, a new UUID is minted server-side. The frontend is
 * responsible for persisting the returned cookie_id in a first-party cookie
 * and attaching it to subsequent tracking requests.
 *
 * The row is upserted on cookie_id so a user toggling consent off after
 * initially accepting overwrites the previous record (no consent history).
 *
 * Writes use the service-role client because cookie_consents has no
 * end-user-facing INSERT/UPDATE policy.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  if (typeof obj.consented !== 'boolean') {
    return errorResponse('A "consented" mező kötelező (boolean)', 400)
  }

  let cookieId: string
  if (obj.cookie_id === undefined || obj.cookie_id === null) {
    cookieId = randomUUID()
  } else if (typeof obj.cookie_id === 'string' && UUID_RE.test(obj.cookie_id)) {
    cookieId = obj.cookie_id
  } else {
    return errorResponse('A "cookie_id" mezőnek érvényes UUID-nak kell lennie', 400)
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('cookie_consents')
    .upsert(
      { cookie_id: cookieId, consented: obj.consented } as never,
      { onConflict: 'cookie_id' }
    )
    .select('cookie_id, consented, created_at')
    .single()

  if (error || !data) {
    return errorResponse(
      `Beleegyezés rögzítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data)
}
