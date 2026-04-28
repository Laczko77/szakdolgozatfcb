import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Profile } from '@/types/database'

/**
 * /api/users/[id]/following
 *
 * GET — publikus: visszaadja, hogy az adott user kiket követ
 *       (profil-mezőkkel: id, username, avatar_url).
 *
 * Implementáció: lásd /api/users/[id]/followers — kétfázisú lookup,
 * mert a follows FK auth.users-re mutat, nem profiles-ra.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: targetId } = await context.params
  if (!targetId || !UUID_RE.test(targetId)) {
    return errorResponse('Érvénytelen felhasználói azonosító', 400)
  }

  const { searchParams } = new URL(request.url)
  const page = clampInt(searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)

  const supabase = await createClient()

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data: rows, error, count } = await supabase
    .from('follows')
    .select('following_id, created_at', { count: 'exact' })
    .eq('follower_id', targetId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return errorResponse(`Követett userek lekérése sikertelen: ${error.message}`, 500)
  }

  const followingIds = ((rows ?? []) as Array<{ following_id: string }>).map((r) => r.following_id)
  const profilesById = await fetchProfilesByIds(supabase, followingIds)

  const following = followingIds
    .map((id) => profilesById.get(id))
    .filter((p): p is Pick<Profile, 'id' | 'username' | 'avatar_url'> => p !== undefined)

  return NextResponse.json({
    following,
    total: count ?? 0,
    page,
    totalPages: count ? Math.ceil(count / limit) : 0,
  })
}

async function fetchProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url'>>> {
  const out = new Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url'>>()
  if (ids.length === 0) return out

  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', ids)

  for (const p of (data ?? []) as Pick<Profile, 'id' | 'username' | 'avatar_url'>[]) {
    out.set(p.id, p)
  }
  return out
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}
