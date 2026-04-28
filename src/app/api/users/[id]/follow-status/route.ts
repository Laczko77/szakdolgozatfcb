import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'

/**
 * /api/users/[id]/follow-status
 *
 * GET — visszaadja, hogy a hívó user követi-e [id]-t (`isFollowing`),
 *       és hogy [id] követi-e a hívót (`isFollowedBy`). A két irány alapján
 *       a frontend tudja eldönteni, hogy DM-szál indítható-e (mutual follow).
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: targetId } = await context.params
  if (!targetId || !UUID_RE.test(targetId)) {
    return errorResponse('Érvénytelen felhasználói azonosító', 400)
  }
  if (targetId === user.id) {
    return NextResponse.json({ isFollowing: false, isFollowedBy: false, isSelf: true })
  }

  const supabase = await createClient()

  const [{ data: outbound, error: outErr }, { data: inbound, error: inErr }] = await Promise.all([
    supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetId)
      .maybeSingle(),
    supabase
      .from('follows')
      .select('id')
      .eq('follower_id', targetId)
      .eq('following_id', user.id)
      .maybeSingle(),
  ])

  if (outErr) return errorResponse(`Követési státusz lekérése sikertelen: ${outErr.message}`, 500)
  if (inErr) return errorResponse(`Követési státusz lekérése sikertelen: ${inErr.message}`, 500)

  return NextResponse.json({
    isFollowing: outbound !== null,
    isFollowedBy: inbound !== null,
    isMutual: outbound !== null && inbound !== null,
  })
}
