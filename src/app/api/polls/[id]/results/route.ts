import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Poll } from '@/types/database'

/**
 * GET /api/polls/[id]/results
 *
 * Public. Returns per-option vote counts for a single poll. If the poll has
 * been resolved, the response includes `correct_option`.
 *
 * Aggregate counts are read from the `poll_results` view (migration 009),
 * which does not expose individual voter ids — anonymous and authenticated
 * users see the same shape.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: pollId } = await context.params
  if (!pollId) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: pollRaw, error: pollError } = await supabase
    .from('polls')
    .select('id, question, options, correct_option, is_active, match_id, created_at')
    .eq('id', pollId)
    .maybeSingle()

  if (pollError) {
    return errorResponse(`Szavazás lekérése sikertelen: ${pollError.message}`, 500)
  }
  if (!pollRaw) {
    return errorResponse('A szavazás nem található', 404)
  }
  const poll = pollRaw as Poll

  const { data: countsRaw, error: countsError } = await supabase
    .from('poll_results' as never)
    .select('selected_option, vote_count')
    .eq('poll_id', pollId)

  if (countsError) {
    return errorResponse(
      `Eredmények lekérése sikertelen: ${countsError.message}`,
      500
    )
  }

  const results: Record<number, number> = {}
  let total = 0
  for (const row of (countsRaw ?? []) as Array<{
    selected_option: number
    vote_count: number
  }>) {
    results[row.selected_option] = row.vote_count
    total += row.vote_count
  }

  // Pad missing options with 0 so the frontend always has every key present.
  const optionCount = Array.isArray(poll.options) ? poll.options.length : 0
  for (let i = 0; i < optionCount; i++) {
    if (results[i] === undefined) results[i] = 0
  }

  return NextResponse.json({
    poll,
    results,
    total_votes: total,
  })
}
