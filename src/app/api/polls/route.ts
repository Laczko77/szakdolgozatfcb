import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Poll, Vote } from '@/types/database'

/**
 * GET /api/polls
 *
 * Public list. Returns active and resolved polls in a single payload so the
 * frontend can render both "vote now" cards and "results" cards from one
 * fetch.
 *
 * Query params:
 *   - status: 'active' | 'resolved' | 'all'  (default 'all')
 *   - match_id: optional UUID, filter to a specific match's polls
 *
 * For authenticated callers, each poll is enriched with `user_vote` (the
 * caller's `selected_option` if they voted, otherwise null) so the UI can
 * skip the "have I voted yet?" round-trip.
 *
 * Aggregate per-option vote counts come from the `poll_results` view (defined
 * in migration 009) which sidesteps the votes RLS while exposing only counts.
 */

type Status = 'active' | 'resolved' | 'all'

type EnrichedPoll = Poll & {
  results: Record<number, number>
  total_votes: number
  user_vote: number | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const statusParam = searchParams.get('status')
  const status: Status =
    statusParam === 'active' || statusParam === 'resolved' || statusParam === 'all'
      ? statusParam
      : 'all'

  const matchId = searchParams.get('match_id')

  const supabase = await createClient()

  let query = supabase
    .from('polls')
    .select('*')
    .order('created_at', { ascending: false })

  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'resolved') query = query.eq('is_active', false)
  if (matchId) query = query.eq('match_id', matchId)

  const { data: pollsRaw, error } = await query

  if (error) {
    return errorResponse(`Szavazások lekérése sikertelen: ${error.message}`, 500)
  }

  const polls = (pollsRaw ?? []) as Poll[]
  const pollIds = polls.map((p) => p.id)

  const [resultsByPoll, userVoteByPoll] = await Promise.all([
    fetchResults(supabase, pollIds),
    fetchUserVotes(supabase, pollIds),
  ])

  const enriched: EnrichedPoll[] = polls.map((poll) => {
    const results = resultsByPoll[poll.id] ?? {}
    const total = Object.values(results).reduce((acc, n) => acc + n, 0)
    return {
      ...poll,
      results,
      total_votes: total,
      user_vote: userVoteByPoll[poll.id] ?? null,
    }
  })

  return NextResponse.json({ polls: enriched })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pollIds: string[]
): Promise<Record<string, Record<number, number>>> {
  if (pollIds.length === 0) return {}

  // The `poll_results` view exposes (poll_id, selected_option, vote_count) and
  // is granted SELECT to anon + authenticated.
  const { data } = await supabase
    .from('poll_results' as never)
    .select('poll_id, selected_option, vote_count')
    .in('poll_id', pollIds)

  const out: Record<string, Record<number, number>> = {}
  for (const row of (data ?? []) as Array<{
    poll_id: string
    selected_option: number
    vote_count: number
  }>) {
    const bucket = (out[row.poll_id] ??= {})
    bucket[row.selected_option] = row.vote_count
  }
  return out
}

async function fetchUserVotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pollIds: string[]
): Promise<Record<string, number>> {
  if (pollIds.length === 0) return {}

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return {}

  // RLS: votes_select_own_or_admin already restricts this to auth.uid() rows.
  const { data } = await supabase
    .from('votes')
    .select('poll_id, selected_option')
    .eq('user_id', user.id)
    .in('poll_id', pollIds)

  const out: Record<string, number> = {}
  for (const row of (data ?? []) as Array<Pick<Vote, 'poll_id' | 'selected_option'>>) {
    out[row.poll_id] = row.selected_option
  }
  return out
}
