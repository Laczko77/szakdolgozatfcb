import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'

/**
 * /api/users/[id]/follow
 *
 * POST   — a hívó user követni kezdi az [id] user-t.
 * DELETE — a hívó user kikövet az [id] user-ből.
 *
 * Saját magát senki nem követheti — a follows tábla CHECK is védi, de
 * itt 400-zal térünk vissza, hogy értelmes hibaüzenetet adjunk.
 *
 * RLS: follows_insert_own / follows_delete_own gondoskodik arról, hogy
 *      egy user csak a saját follower_id-jével tudjon írni.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: targetId } = await context.params
  if (!targetId || !UUID_RE.test(targetId)) {
    return errorResponse('Érvénytelen felhasználói azonosító', 400)
  }
  if (targetId === user.id) {
    return errorResponse('Saját magadat nem követheted', 400)
  }

  // Target profil ellenőrzés service-role klienssel: a profiles SELECT RLS
  // policy `auth.uid() = id OR is_admin()`, így a normál user kliens nem
  // látna idegen profilt és minden követés 404-gyel végződne. A service-role
  // bypass-olja az RLS-t, de csak a létezésre kérdezünk rá — nem szivárogtat
  // bizalmas mezőt vissza a frontendnek.
  const adminSupabase = createServiceRoleClient()
  const { data: targetProfile, error: targetErr } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('id', targetId)
    .maybeSingle()
  if (targetErr) {
    return errorResponse(`Profil keresése sikertelen: ${targetErr.message}`, 500)
  }
  if (!targetProfile) {
    return errorResponse('A felhasználó nem található', 404)
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, following_id: targetId } as never)

  if (error) {
    // Egyedi pair constraint (már követed) — idempotensen kezeljük.
    if (error.code === '23505') {
      return NextResponse.json({ success: true, alreadyFollowing: true })
    }
    return errorResponse(`Követés sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: targetId } = await context.params
  if (!targetId || !UUID_RE.test(targetId)) {
    return errorResponse('Érvénytelen felhasználói azonosító', 400)
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', targetId)

  if (error) {
    return errorResponse(`Kikövetés sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ success: true })
}
