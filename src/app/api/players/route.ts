import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import { PLAYER_POSITIONS, isPlayerPosition } from '@/lib/constants'
import type { Player } from '@/types/database'

/**
 * GET /api/players
 *
 * Public endpoint. Returns the FC Barcelona squad.
 *
 * Query params:
 *   - position (optional): one of "Goalkeeper" | "Defender" | "Midfielder" | "Attacker"
 *   - season   (optional): integer; when omitted, ALL players are returned
 *     regardless of the season they were last synced under. The previous
 *     behaviour of auto-filtering to the single latest season hid players
 *     whose `season` field happened to be older than the most-recent sync
 *     run, which is misleading for a "current squad" page — we now defer
 *     to whatever rows the admin chose to keep in the table.
 *
 * Sorting: position groups follow PLAYER_POSITIONS order (GK → DEF → MID → ATT),
 * then jersey number ascending within each group. We sort in JS because Postgres
 * has no native order over a custom string-to-rank map without a CASE expression
 * that bloats the SQL — for ~30 rows it's a non-issue.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const position = searchParams.get('position')
  const seasonRaw = searchParams.get('season')

  if (position !== null && !isPlayerPosition(position)) {
    return errorResponse('Érvénytelen pozíció', 400)
  }

  let season: number | null = null
  if (seasonRaw !== null) {
    const parsed = Number.parseInt(seasonRaw, 10)
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
      return errorResponse('Érvénytelen szezon', 400)
    }
    season = parsed
  }

  const supabase = await createClient()

  // Explicit upper bound: a senior squad never exceeds ~50 players. We pin
  // the limit to 200 to defend against the PostgREST `max-rows` cap (which
  // otherwise silently truncates the result set — observed 13/33 rows
  // returned in production when no limit was provided).
  let query = supabase.from('players').select('*').limit(200)
  if (season !== null) {
    query = query.eq('season', season)
  }
  if (position) {
    query = query.eq('position', position)
  }

  const { data, error } = await query

  if (error) {
    return errorResponse(`Játékosok lekérése sikertelen: ${error.message}`, 500)
  }

  const players = sortPlayers((data ?? []) as Player[])

  return NextResponse.json({ players })
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

const POSITION_RANK: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  PLAYER_POSITIONS.forEach((pos, idx) => {
    map[pos] = idx
  })
  return map
})()

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const ra = a.position !== null && a.position in POSITION_RANK
      ? POSITION_RANK[a.position]
      : PLAYER_POSITIONS.length
    const rb = b.position !== null && b.position in POSITION_RANK
      ? POSITION_RANK[b.position]
      : PLAYER_POSITIONS.length
    if (ra !== rb) return ra - rb

    const na = a.number ?? Number.MAX_SAFE_INTEGER
    const nb = b.number ?? Number.MAX_SAFE_INTEGER
    if (na !== nb) return na - nb

    return a.name.localeCompare(b.name)
  })
}
