import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Profile } from '@/types/database'

/**
 * /api/users/search?q=<text>
 *
 * GET — username VAGY email szerinti ILIKE keresés a profiles táblában.
 *       - max 20 találat
 *       - csak publikus mezők (id, username, avatar_url) a válaszban
 *       - a hívó user nem szerepel a találatokban
 *       - üres / túl rövid q → üres lista
 *
 * Auth: bejelentkezett userek számára érhető el.
 *
 * Implementáció: a profiles SELECT RLS (`auth.uid() = id OR is_admin()`) miatt
 * a normál cookie-kliens csak a saját profilját látná, így a keresés mindig
 * üres lenne. Ezért service-role klienst használunk, de a válaszban csak
 * publikus mezőket adunk vissza — bizalmas adat (pl. email) nem szivárog.
 */

const MAX_RESULTS = 20
const MIN_QUERY_LENGTH = 2

export async function GET(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { searchParams } = new URL(request.url)
  const qRaw = (searchParams.get('q') ?? '').trim()

  if (qRaw.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ users: [] })
  }

  // Postgres ILIKE wildcard escape — `%`, `_` és `\` literal-ként.
  const escaped = qRaw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const pattern = `%${escaped}%`

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .or(`username.ilike.${pattern},email.ilike.${pattern}`)
    .neq('id', user.id)
    .order('username', { ascending: true })
    .limit(MAX_RESULTS)

  if (error) {
    return errorResponse(`Keresés sikertelen: ${error.message}`, 500)
  }

  const users = (data ?? []) as Pick<Profile, 'id' | 'username' | 'avatar_url'>[]
  return NextResponse.json({ users })
}
