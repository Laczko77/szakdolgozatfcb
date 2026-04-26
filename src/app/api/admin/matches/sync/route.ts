import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import {
  ApiFootballConfigError,
  fetchBarcaFixtures,
  type FixtureApiResponse,
} from '@/lib/api-football'
import type { TablesInsert } from '@/types/database'

/**
 * POST /api/admin/matches/sync
 *
 * Admin-triggered job: pulls FC Barcelona fixtures from API-Football and
 * upserts each one into `public.matches`. Conflict resolution by
 * `api_football_id` (UNIQUE in schema).
 *
 * Body: `{ next?: number, season?: number }`. If both are omitted the helper
 * defaults to the next 10 upcoming fixtures. `next` takes precedence over
 * `season` when both are supplied.
 *
 * The endpoint never deletes matches — past sync runs are not authoritative
 * for the existence of a fixture (admin may have created sectors against an
 * old match that has since been removed from API-Football's response window).
 */

const MAX_NEXT = 50
const MIN_SEASON = 2000
const MAX_SEASON = 2100

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  // ---- Parse body ---------------------------------------------------------
  let next: number | undefined
  let season: number | undefined

  try {
    const text = await request.text()
    if (text.trim().length > 0) {
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as { next?: unknown; season?: unknown }
        if (typeof obj.next === 'number' && Number.isInteger(obj.next)) {
          if (obj.next < 1 || obj.next > MAX_NEXT) {
            return errorResponse(
              `A "next" érték 1 és ${MAX_NEXT} között kell legyen`,
              400
            )
          }
          next = obj.next
        }
        if (typeof obj.season === 'number' && Number.isInteger(obj.season)) {
          if (obj.season < MIN_SEASON || obj.season > MAX_SEASON) {
            return errorResponse('Érvénytelen szezon', 400)
          }
          season = obj.season
        }
      }
    }
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  // ---- Fetch from API-Football -------------------------------------------
  let fixtures: FixtureApiResponse[]
  try {
    fixtures = await fetchBarcaFixtures({ next, season })
  } catch (err) {
    if (err instanceof ApiFootballConfigError) {
      return errorResponse(
        'Az API-Football kulcs nincs beállítva (API_FOOTBALL_KEY)',
        503
      )
    }
    return errorResponse(
      err instanceof Error
        ? `API-Football hiba: ${err.message}`
        : 'API-Football hiba',
      502
    )
  }

  if (fixtures.length === 0) {
    return successResponse({ synced: 0, errors: [] })
  }

  // ---- Upsert -------------------------------------------------------------
  const supabase = createServiceRoleClient()
  const errors: string[] = []
  let synced = 0

  for (const item of fixtures) {
    try {
      const insert: TablesInsert<'matches'> = {
        api_football_id: item.fixture.id,
        home_team: item.teams.home.name,
        away_team: item.teams.away.name,
        date: item.fixture.date,
        venue: item.fixture.venue?.name ?? null,
        status: item.fixture.status?.short ?? null,
      }

      const { error: upsertError } = await supabase
        .from('matches')
        .upsert(insert as never, {
          onConflict: 'api_football_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        errors.push(
          `Meccs #${item.fixture.id} (${item.teams.home.name} vs ${item.teams.away.name}): ${upsertError.message}`
        )
        continue
      }

      synced += 1
    } catch (err) {
      errors.push(
        `Meccs #${item.fixture.id}: ${
          err instanceof Error ? err.message : 'ismeretlen hiba'
        }`
      )
    }
  }

  return successResponse({ synced, errors })
}
