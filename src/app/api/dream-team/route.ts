import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type {
  DreamTeam,
  DreamTeamInsert,
  DreamTeamPlayerSlot,
} from '@/types/database'
import {
  MAX_DREAM_TEAMS_PER_USER,
  validateDreamTeamPayload,
} from './_validation'

/**
 * /api/dream-team
 *
 * GET  — authenticated, lists the caller's saved álomcsapatok (max 5).
 * POST — authenticated, creates a new álomcsapat. Enforces the per-user limit
 *        of 5 teams in the application layer so we can return a beszédes 400.
 *
 * RLS already restricts access to the owner; the explicit user_id filter
 * below is defense-in-depth and documents intent.
 */

// ---------------------------------------------------------------------------
// GET — list the caller's álomcsapatok
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dream_teams')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_DREAM_TEAMS_PER_USER)

  if (error) {
    return errorResponse(`Álomcsapatok lekérése sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ items: (data ?? []) as DreamTeam[] })
}

// ---------------------------------------------------------------------------
// POST — create new álomcsapat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  const parsed = validateDreamTeamPayload(body, { partial: false })
  if (!parsed.ok) return errorResponse(parsed.error, 400)

  const supabase = await createClient()

  // Enforce max 5 teams / user. RLS lets the user see only their own rows,
  // so a count(*) here is naturally scoped without an explicit user_id filter
  // — we add it anyway for clarity and as defense-in-depth.
  const { count, error: countError } = await supabase
    .from('dream_teams')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return errorResponse(
      `Álomcsapatok számának ellenőrzése sikertelen: ${countError.message}`,
      500
    )
  }
  if ((count ?? 0) >= MAX_DREAM_TEAMS_PER_USER) {
    return errorResponse(
      `Maximum ${MAX_DREAM_TEAMS_PER_USER} álomcsapatod lehet`,
      400
    )
  }

  const insert: DreamTeamInsert = {
    user_id: user.id,
    formation: parsed.value.formation,
    name: parsed.value.name ?? 'Álomcsapatom',
    players: (parsed.value.players ?? []) as DreamTeamPlayerSlot[],
  }

  const { data, error } = await supabase
    .from('dream_teams')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Álomcsapat létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as DreamTeam, 201)
}
