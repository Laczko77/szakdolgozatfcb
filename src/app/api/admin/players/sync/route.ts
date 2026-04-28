import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import {
  CHAMPIONS_LEAGUE_COMPETITION_ID,
  FootballDataConfigError,
  FootballDataRequestError,
  LA_LIGA_COMPETITION_ID,
  currentSeasonStartYear,
  getScorers,
  getSquad,
  type NormalizedScorer,
  type SquadPlayer,
} from '@/lib/football-data'
import type { Json, TablesInsert } from '@/types/database'

/**
 * POST /api/admin/players/sync
 *
 * Admin-triggered job: pulls the current FC Barcelona squad from
 * football-data.org and aggregates La Liga + Champions League scoring
 * statistics, then upserts every player into `public.players`.
 *
 * Conflict resolution: `api_football_id` (UNIQUE in schema). On re-run we
 * overwrite name/position/number/stats/season — but we DO NOT touch
 * `bio` or `image_url`. Those fields are owned by the admin manual editor
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

  // ---- Fetch from football-data.org --------------------------------------
  let squad: SquadPlayer[]
  let laLigaScorers: NormalizedScorer[]
  let championsLeagueScorers: NormalizedScorer[]

  try {
    squad = await getSquad()
    laLigaScorers = await getScorers(LA_LIGA_COMPETITION_ID, season)
    championsLeagueScorers = await getScorers(
      CHAMPIONS_LEAGUE_COMPETITION_ID,
      season
    )
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

  if (squad.length === 0) {
    console.log(`${LOG_PREFIX} squad empty, nothing to sync`)
    return successResponse({ synced: 0, errors: [], season })
  }

  // ---- Aggregate scorer stats by FCB player id ---------------------------
  // Only scorers whose player.id matches a squad member contribute. Fallback
  // to zeros when a player did not appear in either competition.
  //
  // ID-mapping: football-data.org returns the same numeric player id from
  // /teams/{id} (squad) and /competitions/{id}/scorers — so the join key is
  // simply `player.id`. Players who do not appear in either scorers list end
  // up with all-zero stats (the /scorers endpoint only returns the top-100
  // ranked players per competition, so bench/unused squad members are
  // expected to fall through with zeros — this is an upstream limitation,
  // NOT a mapping bug).
  const statsByPlayerId = aggregateScorerStats(
    squad,
    laLigaScorers,
    championsLeagueScorers
  )

  const squadIds = new Set(squad.map((m) => m.id))
  const matchedScorerIds = new Set<number>()
  const unmatchedScorerNames: string[] = []
  for (const scorer of [...laLigaScorers, ...championsLeagueScorers]) {
    if (squadIds.has(scorer.playerId)) {
      matchedScorerIds.add(scorer.playerId)
    } else {
      unmatchedScorerNames.push(`${scorer.playerName}#${scorer.playerId}`)
    }
  }

  const playersWithStatsCount = Array.from(statsByPlayerId.values()).filter(
    (s) => s.appearances > 0 || s.goals > 0 || s.assists > 0
  ).length
  const playersWithoutStatsCount = squad.length - playersWithStatsCount

  console.log(
    `${LOG_PREFIX} scorers fetched: laLiga=${laLigaScorers.length} ` +
      `cl=${championsLeagueScorers.length}; squadMembers=${squad.length} ` +
      `matchedToScorer=${matchedScorerIds.size} ` +
      `noStats=${playersWithoutStatsCount} ` +
      `(reason: not in either competition's top-100 scorers list)`
  )
  if (unmatchedScorerNames.length > 0) {
    console.log(
      `${LOG_PREFIX} ${unmatchedScorerNames.length} scorer rows did not match ` +
        `any FCB squad id (these are non-FCB players in the same competition; ` +
        `expected and ignored)`
    )
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
      const stats = sanitizeStats(statsByPlayerId.get(member.id))

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
    `${LOG_PREFIX} note: games_started, minutes, yellow_cards, red_cards are ` +
      `not provided by /competitions/{id}/scorers — stored as 0`
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
 * Build a `playerId → stats` map summing La Liga + Champions League rows
 * for every squad member. Players who do not appear in either scorers
 * list end up with an all-zero stats payload (they have not yet scored,
 * assisted or played enough to be ranked — not a hard error).
 */
function aggregateScorerStats(
  squad: SquadPlayer[],
  laLigaScorers: NormalizedScorer[],
  championsLeagueScorers: NormalizedScorer[]
): Map<number, PlayerStatsPayload> {
  const result = new Map<number, PlayerStatsPayload>()
  for (const member of squad) {
    result.set(member.id, emptyStats())
  }

  for (const scorer of [...laLigaScorers, ...championsLeagueScorers]) {
    const target = result.get(scorer.playerId)
    if (!target) continue // scorer is not on the FCB squad — skip
    target.goals += scorer.goals
    target.assists += scorer.assists
    target.appearances += scorer.playedMatches
  }

  return result
}
