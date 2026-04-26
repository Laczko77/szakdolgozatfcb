import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Match, MatchSector, Ticket } from '@/types/database'

/**
 * GET /api/tickets
 *
 * Authenticated. Returns the caller's own tickets, grouped into `upcoming`
 * and `past` based on the linked match's date.
 *
 * Each ticket is enriched with its sector and the sector's match, so the
 * frontend can render "FC Barcelona vs Real Madrid — Sector A — Seat 17"
 * without further requests.
 */

type TicketWithRelations = Ticket & {
  sector: (MatchSector & { match: Match | null }) | null
}

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  // RLS-bound client: tickets_select_own_or_admin already restricts the
  // result to the caller's rows, but we still filter explicitly for clarity
  // and so that admin sessions don't accidentally see everyone else.
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tickets')
    .select(
      `
      *,
      sector:match_sectors (
        *,
        match:matches (*)
      )
    `
    )
    .eq('user_id', user.id)
    .order('purchased_at', { ascending: false })

  if (error) {
    return errorResponse(`Jegyek lekérése sikertelen: ${error.message}`, 500)
  }

  const tickets = (data ?? []) as unknown as TicketWithRelations[]
  const now = Date.now()

  const upcoming: TicketWithRelations[] = []
  const past: TicketWithRelations[] = []

  for (const t of tickets) {
    const matchDate = t.sector?.match?.date
    // Tickets with a missing match (deleted out-of-band) are surfaced under
    // `past` so the user can still see them.
    if (matchDate && new Date(matchDate).getTime() >= now) {
      upcoming.push(t)
    } else {
      past.push(t)
    }
  }

  // Sort upcoming by match date ascending (next match first).
  upcoming.sort((a, b) => {
    const ad = a.sector?.match?.date ?? ''
    const bd = b.sector?.match?.date ?? ''
    return ad.localeCompare(bd)
  })

  return NextResponse.json({ upcoming, past })
}
