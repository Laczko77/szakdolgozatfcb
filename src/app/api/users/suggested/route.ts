import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Profile } from '@/types/database'

/**
 * GET /api/users/suggested
 *
 * Javasolt szurkolók a bejelentkezett user számára: olyan userek, akiket
 * még NEM követ (se pending, se accepted állapotban), és nem ő maga.
 *
 * Sorrend: legutóbb regisztráltak előre. Limit: 10.
 *
 * Response:
 *   { users: [{ id, username, avatar_url }] }
 *
 * A profiles SELECT RLS (`auth.uid() = id OR is_admin()`) miatt service-role
 * klienst használunk; csak publikus mezőket adunk vissza.
 */

const SUGGEST_LIMIT = 10

type PublicProfile = Pick<Profile, 'id' | 'username' | 'avatar_url'>

export async function GET(_request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = createServiceRoleClient()

  // 1. lépés: a hívó user által érintett (akár pending, akár accepted)
  // followingId-k halmaza. Ezeket kihagyjuk a javaslatokból.
  const { data: followsRaw, error: followsErr } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (followsErr) {
    return errorResponse(`Követések lekérése sikertelen: ${followsErr.message}`, 500)
  }

  const excludedIds = new Set<string>([user.id])
  for (const row of (followsRaw ?? []) as Array<{ following_id: string }>) {
    excludedIds.add(row.following_id)
  }

  // 2. lépés: legutóbbi profilok lekérdezése a kizárás-listával.
  // A `not.in` egyszerűbb és olvashatóbb, mint a NOT IN subquery — viszont
  // hosszú listánál URL-méret limitre futhatunk; gyakorlatban a felhasználói
  // lista mérete nem indokol további bonyolítást.
  let query = supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .order('created_at', { ascending: false })
    .limit(SUGGEST_LIMIT)

  if (excludedIds.size > 0) {
    const idList = Array.from(excludedIds).join(',')
    query = query.not('id', 'in', `(${idList})`)
  }

  const { data, error } = await query
  if (error) {
    return errorResponse(`Javasolt felhasználók lekérése sikertelen: ${error.message}`, 500)
  }

  const users = (data ?? []) as PublicProfile[]
  return NextResponse.json({ users })
}
