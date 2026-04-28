import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Profile } from '@/types/database'

/**
 * GET /api/users/[id]/profile
 *
 * Publikus user profil oldal forrása — NEM kell auth.
 *
 * Response:
 *   { id, username, avatar_url, created_at, post_count }
 *
 * Bizalmas mezők (email, role, points, stb.) NEM szerepelnek a válaszban.
 *
 * A profiles SELECT RLS (`auth.uid() = id OR is_admin()`) miatt service-role
 * klienst használunk — különben csak a saját profilt lehetne lekérdezni, ami
 * lehetetlenné tenné a publikus profil-oldalt.
 *
 * Hibakezelés:
 *   400 — érvénytelen UUID
 *   404 — nem létező user
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: targetId } = await context.params
  if (!targetId || !UUID_RE.test(targetId)) {
    return errorResponse('Érvénytelen felhasználói azonosító', 400)
  }

  const supabase = createServiceRoleClient()

  const { data: profileRaw, error: profileErr } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, created_at')
    .eq('id', targetId)
    .maybeSingle()

  if (profileErr) {
    return errorResponse(`Profil lekérése sikertelen: ${profileErr.message}`, 500)
  }
  if (!profileRaw) {
    return errorResponse('A felhasználó nem található', 404)
  }
  const profile = profileRaw as Pick<
    Profile,
    'id' | 'username' | 'avatar_url' | 'created_at'
  >


  // Posztok száma — head + count együtt csak a metaadatot adja vissza, sorokat nem.
  const { count, error: countErr } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', targetId)

  if (countErr) {
    return errorResponse(`Posztok számának lekérése sikertelen: ${countErr.message}`, 500)
  }

  return NextResponse.json({
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url,
    created_at: profile.created_at,
    post_count: count ?? 0,
  })
}
