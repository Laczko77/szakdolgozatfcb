import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'

/**
 * /api/users/[id]/follow
 *
 * Iter22-től a követés jóváhagyás-alapú:
 *   POST   — `pending` állapotú sort hoz létre. Idempotens: ha már van sor
 *            (akár pending, akár accepted), success-szel térünk vissza.
 *   DELETE — törli a sort (kikövetés vagy függő kérelem visszavonása).
 *
 * Saját magát senki nem követheti — a follows tábla CHECK is védi, de
 * itt 400-zal térünk vissza, hogy értelmes hibaüzenetet adjunk.
 *
 * RLS: follows_insert_own gondoskodik arról, hogy csak saját follower_id-vel
 *      és csak `pending` státusszal lehessen INSERT-et végezni.
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
  // látna idegen profilt és minden követés 404-gyel végződne.
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
    .insert({
      follower_id: user.id,
      following_id: targetId,
      status: 'pending',
    } as never)

  if (error) {
    // Egyedi pair constraint (már van pending vagy accepted sor) — idempotensen
    // kezeljük: a kliens szempontjából a "kérelem elküldve" állapot már létezik.
    if (error.code === '23505') {
      return NextResponse.json({ success: true, alreadyRequested: true })
    }
    return errorResponse(`Követési kérelem küldése sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ success: true, status: 'pending' }, { status: 201 })
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
