import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'

/**
 * /api/users/[id]/follow-status
 *
 * GET — visszaadja a hívó user kapcsolatát az [id] target user-rel:
 *
 *   { status: 'not_following' | 'pending' | 'following' }
 *
 *     - `not_following` — nincs sor a follows táblában
 *     - `pending`       — a hívó már küldött kérelmet, de még nincs elfogadva
 *     - `following`     — elfogadott követés (status = 'accepted')
 *
 * A RLS policy biztosítja, hogy a hívó saját pending sorát is látja,
 * így a SELECT korrekt eredményt ad.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type FollowStatus = 'not_following' | 'pending' | 'following'

export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: targetId } = await context.params
  if (!targetId || !UUID_RE.test(targetId)) {
    return errorResponse('Érvénytelen felhasználói azonosító', 400)
  }
  if (targetId === user.id) {
    return NextResponse.json({ status: 'not_following' satisfies FollowStatus })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', user.id)
    .eq('following_id', targetId)
    .maybeSingle()

  if (error) {
    return errorResponse(`Követési státusz lekérése sikertelen: ${error.message}`, 500)
  }

  let status: FollowStatus = 'not_following'
  if (data) {
    const raw = (data as { status: string }).status
    status = raw === 'accepted' ? 'following' : 'pending'
  }

  return NextResponse.json({ status })
}
