import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type {
  DreamTeam,
  DreamTeamPlayerSlot,
  TablesUpdate,
} from '@/types/database'
import { validateDreamTeamPayload } from '../_validation'

/**
 * /api/dream-team/[id]
 *
 * GET    — authenticated, fetch one of the caller's álomcsapatok.
 * PUT    — authenticated, partial update (name, formation, players).
 *          The DB trigger bumps updated_at automatically; we still set it
 *          explicitly to keep the response consistent with the new value
 *          even on backends that lack the trigger.
 * DELETE — authenticated, removes one of the caller's álomcsapatok.
 *
 * Ownership is enforced by RLS (only the owner can SELECT/UPDATE/DELETE).
 * A non-existent or foreign id therefore behaves identically: 404.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// GET — single team detail (own only)
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id || !UUID_REGEX.test(id)) {
    return errorResponse('Érvénytelen azonosító', 400)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dream_teams')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return errorResponse(`Álomcsapat lekérése sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('Az álomcsapat nem található', 404)
  }

  return NextResponse.json(data as DreamTeam)
}

// ---------------------------------------------------------------------------
// PUT — partial update
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id || !UUID_REGEX.test(id)) {
    return errorResponse('Érvénytelen azonosító', 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  const parsed = validateDreamTeamPayload(body, { partial: true })
  if (!parsed.ok) return errorResponse(parsed.error, 400)

  const supabase = await createClient()

  // 404 vs 200: do an existence check first (scoped to the caller) so the
  // PUT does not silently no-op when the row is missing or owned by someone
  // else.
  const { data: existing, error: fetchError } = await supabase
    .from('dream_teams')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Álomcsapat lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('Az álomcsapat nem található', 404)
  }

  const update: TablesUpdate<'dream_teams'> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.value.name !== undefined) update.name = parsed.value.name
  if (parsed.value.formation !== undefined) update.formation = parsed.value.formation
  if (parsed.value.players !== undefined) {
    update.players = parsed.value.players as DreamTeamPlayerSlot[]
  }

  const { data, error } = await supabase
    .from('dream_teams')
    .update(update as never)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Álomcsapat frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as DreamTeam)
}

// ---------------------------------------------------------------------------
// DELETE — remove one of the caller's teams
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id || !UUID_REGEX.test(id)) {
    return errorResponse('Érvénytelen azonosító', 400)
  }

  const supabase = await createClient()

  // Look up first so we can return a clean 404 instead of a silent success.
  const { data: existing, error: fetchError } = await supabase
    .from('dream_teams')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Álomcsapat lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('Az álomcsapat nem található', 404)
  }

  const { error: deleteError } = await supabase
    .from('dream_teams')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) {
    return errorResponse(`Álomcsapat törlése sikertelen: ${deleteError.message}`, 500)
  }

  return NextResponse.json({ success: true })
}
