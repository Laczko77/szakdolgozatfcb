import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'

/**
 * PUT /api/follow-requests/[id]/accept
 *
 * A célszemély (following_id = auth.uid()) elfogadja a függő követési kérelmet.
 * Az UPDATE-et az RLS `follows_update_target_accepts` policy védi:
 *   - csak a célszemély hajthatja végre
 *   - csak `pending` → `accepted` átmenet engedélyezett
 *
 * Hibakezelés:
 *   400 — érvénytelen UUID
 *   401 — nincs bejelentkezett user
 *   404 — nem létezik a kérelem, vagy nem a hívóhoz tartozik, vagy már elfogadták
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PUT(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: requestId } = await context.params
  if (!requestId || !UUID_RE.test(requestId)) {
    return errorResponse('Érvénytelen kérelem azonosító', 400)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('follows')
    .update({ status: 'accepted' } as never)
    .eq('id', requestId)
    .eq('following_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    return errorResponse(`Kérelem elfogadása sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('A kérelem nem található vagy már nem függő', 404)
  }

  return NextResponse.json({ success: true, status: 'accepted' })
}
