import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { currentSeasonStartYear } from '@/lib/football-data'
import {
  ApiFootballConfigError,
  ApiFootballRequestError,
  getPlayerStats,
  getSofascoreSquad,
  type PlayerStatsPayload,
  type SofascoreSquadEntryNormalised,
} from '@/lib/api-football'
import type { Json, TablesInsert } from '@/types/database'

/**
 * POST /api/admin/players/sync
 *
 * Admin-triggered job: pulls the current FC Barcelona squad and the
 * per-player La Liga + Champions League statistics from **Sofascore** (via
 * RapidAPI), then upserts every player into `public.players`.
 *
 * Why a single source: the previous implementation pulled the squad from
 * football-data.org and stats from Sofascore, joining on a normalised full
 * name. Two providers + name matching is fragile (Latin diacritics drift,
 * club nicknames, hyphenation differences). Sofascore is now the only
 * source — squad and stats join on the Sofascore player id with no
 * heuristics.
 *
 * `players.api_football_id` continues to hold the upstream ID (now the
 * Sofascore player ID) so the existing UNIQUE constraint and onConflict
 * key remain in place — no migration required.
 *
 * Conflict resolution: `api_football_id` (UNIQUE in schema). On re-run we
 * overwrite name/position/number/stats/season — but we DO NOT touch `bio`
 * or `image_url`. Those fields are owned by the admin manual editor
 * (PUT /api/admin/players/[id]).
 *
 * Body: `{ season?: number }`. Default season = `currentSeasonStartYear()`.
 */

const MIN_SEASON = 2000
const MAX_SEASON = 2100
const LOG_PREFIX = '[players/sync]'

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const startedAt = Date.now()

  // ---- Parse body ---------------------------------------------------------
  let season: number = currentSeasonStartYear()
  try {
    const text = await request.text()
    if (text.trim().length > 0) {
      const parsed: unknown = JSON.parse(text)
      if (
        parsed &&
        typeof parsed === 'object' &&
        'season' in parsed &&
        typeof (parsed as { season?: unknown }).season === 'number'
      ) {
        const candidate = (parsed as { season: number }).season
        if (
          Number.isInteger(candidate) &&
          candidate >= MIN_SEASON &&
          candidate <= MAX_SEASON
        ) {
          season = candidate
        }
      }
    }
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  // ---- Fetch squad (Sofascore) -------------------------------------------
  let squad: SofascoreSquadEntryNormalised[]
  try {
    squad = await getSofascoreSquad()
  } catch (err) {
    return mapSofascoreError(err, 'squad')
  }

  if (squad.length === 0) {
    console.log(`${LOG_PREFIX} squad empty, nothing to sync`)
    return successResponse({ synced: 0, errors: [], season })
  }

  // ---- Fetch stats (Sofascore) — squad reused to avoid double fetch ------
  let statsByPlayerId: Map<number, PlayerStatsPayload>
  try {
    statsByPlayerId = await getPlayerStats(season, squad)
  } catch (err) {
    return mapSofascoreError(err, 'stats')
  }

  // ---- Look up existing rows so we can preserve bio/image_url ------------
  const supabase = createServiceRoleClient()
  const apiIds = squad.map((p) => p.id)

  const { data: existingRaw, error: fetchError } = await supabase
    .from('players')
    .select('api_football_id')
    .in('api_football_id', apiIds)

  if (fetchError) {
    return errorResponse(
      `Meglévő játékosok lekérése sikertelen: ${fetchError.message}`,
      500
    )
  }

  const existingIds = new Set<number>()
  for (const row of (existingRaw ?? []) as Array<{
    api_football_id: number | null
  }>) {
    if (row.api_football_id !== null) existingIds.add(row.api_football_id)
  }

  // ---- Upsert each squad member ------------------------------------------
  const errors: string[] = []
  let synced = 0
  let playersWithStatsCount = 0

  for (const member of squad) {
    try {
      // Guarantee a fully-populated, non-null stats object so the DB never
      // stores `null` for any individual stat field (frontend treats null
      // as "unknown" and renders blanks instead of "0").
      const stats = sanitizeStats(statsByPlayerId.get(member.id))
      if (
        stats.appearances > 0 ||
        stats.goals > 0 ||
        stats.minutes > 0
      ) {
        playersWithStatsCount += 1
      }

      // Build the insert payload. For existing players we omit `bio` and
      // `image_url` so the admin's manual edits survive a re-sync; for
      // brand-new players we initialize both to null.
      const isExisting = existingIds.has(member.id)
      const fullPayload: TablesInsert<'players'> = {
        api_football_id: member.id,
        name: member.name,
        position: member.position,
        number: member.jerseyNumber,
        image_url: null,
        bio: null,
        stats: stats as unknown as Json,
        season,
        updated_at: new Date().toISOString(),
      }

      const payload: TablesInsert<'players'> = isExisting
        ? (() => {
            const { image_url: _img, bio: _bio, ...rest } = fullPayload
            void _img
            void _bio
            return rest as TablesInsert<'players'>
          })()
        : fullPayload

      const { error: upsertError } = await supabase
        .from('players')
        .upsert(payload as never, {
          onConflict: 'api_football_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        errors.push(
          `Játékos #${member.id} (${member.name}): ${upsertError.message}`
        )
        continue
      }

      synced += 1
    } catch (err) {
      errors.push(
        `Játékos #${member.id} (${member.name}): ${
          err instanceof Error ? err.message : 'ismeretlen hiba'
        }`
      )
    }
  }

  const elapsedMs = Date.now() - startedAt
  console.log(
    `${LOG_PREFIX} season=${season} squadSize=${squad.length} synced=${synced} ` +
      `withStats=${playersWithStatsCount} errors=${errors.length} ` +
      `elapsedMs=${elapsedMs}`
  )
  console.log(
    `${LOG_PREFIX} squad+stats source: Sofascore (La Liga 8 + CL 7); ` +
      `joined by Sofascore player ID`
  )

  return successResponse({ synced, errors, season })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyStats(): PlayerStatsPayload {
  return {
    goals: 0,
    assists: 0,
    appearances: 0,
    games_started: 0,
    minutes: 0,
    yellow_cards: 0,
    red_cards: 0,
  }
}

/**
 * Coerce a (possibly partial / null-bearing) stats payload to a fully-zeroed
 * object. Any individual field that is null/undefined/NaN becomes 0 so the
 * `players.stats` JSONB never contains nulls — frontend reads can rely on
 * every numeric field being present.
 */
function sanitizeStats(
  partial: Partial<PlayerStatsPayload> | undefined
): PlayerStatsPayload {
  const base = emptyStats()
  if (!partial) return base
  const safe = (n: unknown): number =>
    typeof n === 'number' && Number.isFinite(n) ? n : 0
  return {
    goals: safe(partial.goals),
    assists: safe(partial.assists),
    appearances: safe(partial.appearances),
    games_started: safe(partial.games_started),
    minutes: safe(partial.minutes),
    yellow_cards: safe(partial.yellow_cards),
    red_cards: safe(partial.red_cards),
  }
}

/** Map a Sofascore lib error to a HTTP response with a Hungarian message. */
function mapSofascoreError(err: unknown, label: 'squad' | 'stats'): NextResponse {
  if (err instanceof ApiFootballConfigError) {
    return errorResponse(
      'A Sofascore RapidAPI kulcs nincs beállítva (SOFASCORE_RAPIDAPI_KEY)',
      503
    )
  }
  if (err instanceof ApiFootballRequestError) {
    return errorResponse(
      `Sofascore (${label}) nem elérhető: ${err.message}`,
      502
    )
  }
  return errorResponse(
    err instanceof Error
      ? `Sofascore (${label}) hiba: ${err.message}`
      : `Sofascore (${label}) hiba`,
    502
  )
}
