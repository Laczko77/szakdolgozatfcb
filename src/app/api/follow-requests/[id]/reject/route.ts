import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'

/**
 * PUT /api/follow-requests/[id]/reject
 *
 * A célszemély (following_id = auth.uid()) elutasít egy függő követési
 * kérelmet — a sort töröljük. Az RLS `follows_delete_involved` policy
 * engedi, hogy a following_id is törölhessen.
 *
 * Megjegyzés: szándékosan PUT a backlog alapján, hogy a frontend
 * konzisztens fetch hívást használhasson az accept/reject páron.
 *
 * Hibakezelés:
 *   400 — érvénytelen UUID
 *   401 — nincs bejelentkezett user
 *   404 — nem létezik a kérelem, vagy nem a hívóhoz tartozik
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

  // A pending sűkebb feltétel a defense-in-depth miatt: ne lehessen egy
  // accepted követést véletlenül "elutasítani". Az igazi kikövetéshez a
  // DELETE /api/users/[id]/follow szolgál.
  const { data, error } = await supabase
    .from('follows')
    .delete()
    .eq('id', requestId)
    .eq('following_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    return errorResponse(`Kérelem elutasítása sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('A kérelem nem található vagy már nem függő', 404)
  }

  return NextResponse.json({ success: true })
}
