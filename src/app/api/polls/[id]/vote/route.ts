import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type { Poll, TablesInsert, Vote } from '@/types/database'

/**
 * POST /api/polls/[id]/vote
 *
 * Authenticated. Cast a single vote on a poll. Body (JSON):
 *   { selected_option: number }   // 0-based index into poll.options
 *
 * Constraints:
 *   - Poll must exist and have is_active = true.
 *   - selected_option must be a valid index into poll.options.
 *   - One vote per (poll, user) — UNIQUE (poll_id, user_id) at the DB level.
 *     Duplicate attempts surface as 409 Conflict.
 *
 * RLS (votes_insert_own_active) further enforces auth.uid() = user_id and
 * is_active=true on the target poll, so even direct PostgREST calls cannot
 * sneak votes onto resolved polls.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: pollId } = await context.params
  if (!pollId) return errorResponse('Hiányzó azonosító', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés tartalom', 400)
  }
  const obj = body as Record<string, unknown>

  if (
    typeof obj.selected_option !== 'number' ||
    !Number.isInteger(obj.selected_option) ||
    obj.selected_option < 0
  ) {
    return errorResponse(
      'A "selected_option" mező nem-negatív egész szám kell legyen',
      400
    )
  }
  const selectedOption = obj.selected_option

  const supabase = await createClient()

  // Pre-flight checks for friendlier error messages — the RLS policy and
  // unique constraint are the real authorities.
  const { data: pollRaw, error: pollError } = await supabase
    .from('polls')
    .select('id, is_active, options')
    .eq('id', pollId)
    .maybeSingle()

  if (pollError) {
    return errorResponse(`Szavazás lekérése sikertelen: ${pollError.message}`, 500)
  }
  if (!pollRaw) {
    return errorResponse('A szavazás nem található', 404)
  }
  const poll = pollRaw as Pick<Poll, 'id' | 'is_active' | 'options'>

  if (!poll.is_active) {
    return errorResponse('A szavazás már le van zárva', 409)
  }

  const optionCount = Array.isArray(poll.options) ? poll.options.length : 0
  if (selectedOption >= optionCount) {
    return errorResponse(
      `Érvénytelen válaszopció (opciók száma: ${optionCount})`,
      400
    )
  }

  const insert: TablesInsert<'votes'> = {
    poll_id: pollId,
    user_id: user.id,
    selected_option: selectedOption,
  }

  const { data, error } = await supabase
    .from('votes')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    // Unique violation (one-vote-per-user-per-poll).
    if ((error as { code?: string } | null)?.code === '23505') {
      return errorResponse('Erre a szavazásra már szavaztál', 409)
    }
    return errorResponse(
      `Szavazat leadása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Vote, 201)
}
