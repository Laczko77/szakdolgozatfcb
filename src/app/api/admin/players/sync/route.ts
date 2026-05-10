import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import {
  FootballDataConfigError,
  FootballDataRequestError,
  currentSeasonStartYear,
  getSquad,
  type SquadPlayer,
} from '@/lib/football-data'
import {
  ApiFootballConfigError,
  ApiFootballRequestError,
  getPlayerStats,
  normalizePlayerName,
} from '@/lib/api-football'
import type { Json, TablesInsert } from '@/types/database'

/**
 * POST /api/admin/players/sync
 *
 * Admin-triggered job: pulls the current FC Barcelona squad from
 * football-data.org and the per-player La Liga + Champions League
 * statistics from api-football.com, then upserts every player into
 * `public.players`.
 *
 * Why hybrid: football-data.org's `/scorers` endpoint only returns the
 * top-100 ranked players per competition, so defenders, keepers and low
 * scorers fell through with all-zero stats. api-football.com's
 * `/players?team=529` covers the full first-team squad including
 * appearances, lineups, minutes and cards.
 *
 * Squad ↔ stats join: there is no shared player id between the two
 * providers, so the join is on a normalized full name
 * (`normalizePlayerName`). Squad members without a stats entry get all
 * zeros — logged per-player so admins can distinguish "API returned
 * nothing" from "this player genuinely has zero stats".
 *
 * Conflict resolution: `api_football_id` (UNIQUE in schema; populated
 * with the football-data.org id, kept as-is for backward compat). On
 * re-run we overwrite name/position/number/stats/season — but we DO NOT
 * touch `bio` or `image_url`. Those fields are owned by the admin manual
 * editor (PUT /api/admin/players/[id]).
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

  // ---- Fetch squad (football-data.org) -----------------------------------
  let squad: SquadPlayer[]
  try {
    squad = await getSquad()
  } catch (err) {
    if (err instanceof FootballDataConfigError) {
      return errorResponse(
        'A football-data.org API kulcs nincs beállítva (FOOTBALL_DATA_API_KEY)',
        503
      )
    }
    if (err instanceof FootballDataRequestError) {
      return errorResponse(
        `football-data.org nem elérhető: ${err.message}`,
        502
      )
    }
    return errorResponse(
      err instanceof Error
        ? `football-data.org hiba: ${err.message}`
        : 'football-data.org hiba',
      502
    )
  }

  // ---- Fetch stats (api-football.com) ------------------------------------
  let statsByPlayerName: Map<string, PlayerStatsPayload>
  try {
    statsByPlayerName = await getPlayerStats(season)
  } catch (err) {
    if (err instanceof ApiFootballConfigError) {
      return errorResponse(
        'Az api-football.com API kulcs nincs beállítva (API_FOOTBALL_KEY)',
        503
      )
    }
    if (err instanceof ApiFootballRequestError) {
      return errorResponse(
        `api-football.com nem elérhető: ${err.message}`,
        502
      )
    }
    return errorResponse(
      err instanceof Error
        ? `api-football.com hiba: ${err.message}`
        : 'api-football.com hiba',
      502
    )
  }

  if (squad.length === 0) {
    console.log(`${LOG_PREFIX} squad empty, nothing to sync`)
    return successResponse({ synced: 0, errors: [], season })
  }

  // ---- Match stats to squad by normalized full name ----------------------
  // football-data.org and api-football.com use disjoint player-id spaces, so
  // we join on a normalized full name (lowercase, NFD-stripped diacritics,
  // hyphens/apostrophes collapsed to spaces). See `normalizePlayerName` for
  // details. Squad members with no entry on the api-football side get all
  // zeros — logged below.
  const matchedKeys = new Set<string>()
  let playersWithStatsCount = 0
  for (const member of squad) {
    const stats = matchStats(member, statsByPlayerName)
    if (stats.appearances > 0 || stats.goals > 0 || stats.minutes > 0) {
      playersWithStatsCount += 1
      matchedKeys.add(normalizePlayerName(member.name))
    }
  }
  const playersWithoutStatsCount = squad.length - playersWithStatsCount

  // Stats rows present on api-football.com that did not match any squad
  // member (e.g. mid-season departures, B-team players). Informational only.
  const squadKeys = new Set(squad.map((m) => normalizePlayerName(m.name)))
  const orphanStatKeys: string[] = []
  for (const key of statsByPlayerName.keys()) {
    if (!squadKeys.has(key)) orphanStatKeys.push(key)
  }

  console.log(
    `${LOG_PREFIX} stats fetched: apiFootballEntries=${statsByPlayerName.size}; ` +
      `squadMembers=${squad.length} ` +
      `matched=${matchedKeys.size} ` +
      `noStats=${playersWithoutStatsCount} ` +
      `(reason: no La Liga/CL row on api-football.com for the requested season)`
  )
  if (orphanStatKeys.length > 0) {
    console.log(
      `${LOG_PREFIX} ${orphanStatKeys.length} api-football stats rows did not ` +
        `match any FCB squad name (likely departures or B-team; expected and ignored)`
    )
  }

  for (const member of squad) {
    if (!matchedKeys.has(normalizePlayerName(member.name))) {
      console.info(
        `${LOG_PREFIX} no api-football stats for ${member.name} (#${member.id}) — ` +
          `recording zero stats`
      )
    }
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

  for (const member of squad) {
    try {
      // Guarantee a fully-populated, non-null stats object so the DB never
      // stores `null` for any individual stat field (frontend treats null
      // as "unknown" and renders blanks instead of "0").
      const stats = sanitizeStats(matchStats(member, statsByPlayerName))

      // Build the insert payload. For existing players we omit `bio` and
      // `image_url` so the admin's manual edits survive a re-sync; for
      // brand-new players we initialize both to null.
      const isExisting = existingIds.has(member.id)
      const fullPayload: TablesInsert<'players'> = {
        api_football_id: member.id,
        name: member.name,
        position: member.position,
        number: member.shirtNumber,
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
    `${LOG_PREFIX} stats source: api-football.com (La Liga 140 + CL 2); ` +
      `squad source: football-data.org`
  )

  return successResponse({ synced, errors, season })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PlayerStatsPayload {
  goals: number
  assists: number
  appearances: number
  games_started: number
  minutes: number
  yellow_cards: number
  red_cards: number
}

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

/**
 * Look up a squad member's stats in the api-football map by normalized full
 * name. Returns the empty stats sentinel when no entry exists — callers must
 * still pass the result through `sanitizeStats()` before persisting.
 */
function matchStats(
  squadMember: SquadPlayer,
  statsByName: Map<string, PlayerStatsPayload>
): PlayerStatsPayload {
  const key = normalizePlayerName(squadMember.name)
  return statsByName.get(key) ?? emptyStats()
}
