import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Profile } from '@/types/database'

/**
 * /api/follow-requests
 *
 * GET — A bejelentkezett user beérkező követési kérelmei
 *       (`following_id = auth.uid()` ÉS `status = 'pending'`).
 *
 * Response: { requests: [{ id, follower, created_at }] }
 *   ahol follower = { id, username, avatar_url }
 *
 * A profiles RLS (`auth.uid() = id OR is_admin()`) miatt a follower
 * profil-mezőit service-role klienssel hidratáljuk, csak publikus mezőket
 * adunk vissza.
 */

type FollowerProfile = Pick<Profile, 'id' | 'username' | 'avatar_url'>

type FollowRequestRow = {
  id: string
  follower_id: string
  created_at: string
}

export async function GET(_request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { data: rowsRaw, error } = await supabase
    .from('follows')
    .select('id, follower_id, created_at')
    .eq('following_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(`Követési kérelmek lekérése sikertelen: ${error.message}`, 500)
  }

  const rows = (rowsRaw ?? []) as FollowRequestRow[]
  if (rows.length === 0) {
    return NextResponse.json({ requests: [] })
  }

  const followerIds = Array.from(new Set(rows.map((r) => r.follower_id)))
  const profilesById = await fetchProfilesByIds(followerIds)

  const requests = rows.map((row) => ({
    id: row.id,
    follower: profilesById.get(row.follower_id) ?? null,
    created_at: row.created_at,
  }))

  return NextResponse.json({ requests })
}

async function fetchProfilesByIds(
  ids: string[]
): Promise<Map<string, FollowerProfile>> {
  const out = new Map<string, FollowerProfile>()
  if (ids.length === 0) return out

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', ids)

  if (error) {
    console.error('[follow-requests] follower profile lookup failed:', error.message)
    return out
  }

  for (const p of (data ?? []) as FollowerProfile[]) {
    out.set(p.id, p)
  }
  return out
}
