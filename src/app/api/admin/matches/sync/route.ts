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
  getMatches,
  type NormalizedMatch,
} from '@/lib/football-data'
import { seedFixedSectorsForMatch } from '@/lib/sectors-seed'
import type { TablesInsert } from '@/types/database'

/**
 * POST /api/admin/matches/sync
 *
 * Admin-triggered job: pulls FC Barcelona matches for the current season
 * from football-data.org and upserts each one into `public.matches`.
 * Conflict resolution by `api_football_id` (UNIQUE in schema).
 *
 * Body: `{ season?: number }`. Default = `currentSeasonStartYear()`.
 *
 * The endpoint never deletes matches — past sync runs are not authoritative
 * for the existence of a fixture (admin may have created sectors against an
 * older match that has since been removed from the response window).
 *
 * Note: the football-data.org `/teams/{id}/matches` endpoint does not
 * include venue, so `venue` is always written as null on sync.
 */

const MIN_SEASON = 2000
const MAX_SEASON = 2100
const LOG_PREFIX = '[matches/sync]'

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const startedAt = Date.now()

  // ---- Parse body ---------------------------------------------------------
  let season = currentSeasonStartYear()
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
          !Number.isInteger(candidate) ||
          candidate < MIN_SEASON ||
          candidate > MAX_SEASON
        ) {
          return errorResponse('Érvénytelen szezon', 400)
        }
        season = candidate
      }
    }
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  // ---- Fetch from football-data.org --------------------------------------
  let matches: NormalizedMatch[]
  try {
    matches = await getMatches(season)
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

  if (matches.length === 0) {
    console.log(`${LOG_PREFIX} season=${season} no matches returned`)
    return successResponse({ synced: 0, errors: [], season })
  }

  // ---- Upsert -------------------------------------------------------------
  const supabase = createServiceRoleClient()
  const errors: string[] = []
  let synced = 0
  let sectorsSeeded = 0

  for (const match of matches) {
    try {
      const insert: TablesInsert<'matches'> = {
        api_football_id: match.id,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        home_team_crest: match.homeTeamCrest,
        away_team_crest: match.awayTeamCrest,
        date: match.utcDate,
        venue: null,
        status: match.status,
        score: match.score,
        competition: match.competition,
      }

      // Upsert + RETURNING to get the local UUID for the sector seed below.
      const { data: upserted, error: upsertError } = await supabase
        .from('matches')
        .upsert(insert as never, {
          onConflict: 'api_football_id',
          ignoreDuplicates: false,
        })
        .select('id')
        .single()

      if (upsertError || !upserted) {
        errors.push(
          `Meccs #${match.id} (${match.homeTeam} vs ${match.awayTeam}): ${
            upsertError?.message ?? 'ismeretlen hiba'
          }`
        )
        continue
      }

      synced += 1

      // Idempotent fixed-sector seed. ignoreDuplicates means subsequent syncs
      // do NOT overwrite admin-edited prices / capacities.
      const matchRow = upserted as { id: string }
      const seedResult = await seedFixedSectorsForMatch(supabase, matchRow.id)
      if (seedResult.error) {
        errors.push(
          `Meccs #${match.id} szektor seed: ${seedResult.error}`
        )
      } else {
        sectorsSeeded += seedResult.inserted
      }
    } catch (err) {
      errors.push(
        `Meccs #${match.id}: ${
          err instanceof Error ? err.message : 'ismeretlen hiba'
        }`
      )
    }
  }

  const elapsedMs = Date.now() - startedAt
  console.log(
    `${LOG_PREFIX} season=${season} fetched=${matches.length} synced=${synced} ` +
      `sectorsSeeded=${sectorsSeeded} errors=${errors.length} elapsedMs=${elapsedMs}`
  )

  return successResponse({ synced, sectorsSeeded, errors, season })
}
