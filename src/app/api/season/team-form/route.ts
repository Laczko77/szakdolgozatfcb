import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  FCB_TEAM_ID,
  getCompetitionMatches,
  type NormalizedCompetitionMatch,
} from '@/lib/football-data'
import {
  buildCacheKey,
  isFresh,
  mapUpstreamError,
  parseCompetition,
  parseSeason,
  parseTeamId,
} from '../_shared'

/**
 * GET /api/season/team-form
 *
 * Last 10 finished matches of a given team in a given competition+season,
 * each tagged with `result: 'W' | 'D' | 'L'`.
 *
 * Query params:
 *   - competition  alias `laliga` or numeric ID (default 2014)
 *   - season       Season *start* year (defaults to the current season)
 *   - team_id      Numeric team ID (default 81 = FCB)
 *
 * Cache: 1-hour TTL backed by `season_form_cache`.
 *
 * Implementation: reuses `getCompetitionMatches()` (whole-competition feed)
 * and filters to the team locally — same upstream call as the
 * standings-evolution route, so they share rate-limit budget naturally.
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const FORM_WINDOW = 10
const LOG_PREFIX = '[api/season/team-form]'

interface FormMatch {
  match_id: number
  utcDate: string
  matchday: number | null
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  score: { home: number; away: number }
  result: 'W' | 'D' | 'L'
}

interface CachedForm {
  team_id: number
  matches: FormMatch[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const competitionId = parseCompetition(searchParams.get('competition'))
  if (competitionId === null) {
    return errorResponse('Érvénytelen competition paraméter', 400)
  }
  const season = parseSeason(searchParams.get('season'))
  const teamId = parseTeamId(searchParams.get('team_id'), FCB_TEAM_ID)
  const cacheKey = buildCacheKey(['form', competitionId, season, teamId])

  const supabase = createServiceRoleClient()

  // ---- 1. Cache lookup ----------------------------------------------------
  const { data: cacheRow, error: cacheError } = await supabase
    .from('season_form_cache' as never)
    .select('data, cached_at')
    .eq('cache_key', cacheKey)
    .maybeSingle<{ data: CachedForm; cached_at: string }>()

  if (cacheError) {
    console.error(`${LOG_PREFIX} cache lookup failed:`, cacheError.message)
  }

  if (cacheRow && isFresh(cacheRow.cached_at, CACHE_TTL_MS)) {
    return NextResponse.json({
      team_id: cacheRow.data.team_id,
      matches: cacheRow.data.matches,
      cached_at: cacheRow.cached_at,
      season,
      competition_id: competitionId,
    })
  }

  console.log(`${LOG_PREFIX} cache miss for key=${cacheKey}, fetching upstream`)

  // ---- 2. Fetch upstream --------------------------------------------------
  let matches: NormalizedCompetitionMatch[]
  try {
    matches = await getCompetitionMatches(competitionId, season)
  } catch (err) {
    if (cacheRow) {
      console.warn(
        `${LOG_PREFIX} upstream failed, serving stale cache from ${cacheRow.cached_at}:`,
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({
        team_id: cacheRow.data.team_id,
        matches: cacheRow.data.matches,
        cached_at: cacheRow.cached_at,
        season,
        competition_id: competitionId,
        stale: true,
      })
    }
    return mapUpstreamError(err)
  }

  const formMatches = pickLastFinished(matches, teamId, FORM_WINDOW)

  // ---- 3. Persist cache ---------------------------------------------------
  const nowIso = new Date().toISOString()
  const payload: CachedForm = { team_id: teamId, matches: formMatches }

  const { error: upsertError } = await supabase
    .from('season_form_cache' as never)
    .upsert(
      {
        cache_key: cacheKey,
        data: payload,
        cached_at: nowIso,
      } as never,
      { onConflict: 'cache_key' }
    )

  if (upsertError) {
    console.error(`${LOG_PREFIX} cache upsert failed:`, upsertError.message)
  }

  return NextResponse.json({
    team_id: teamId,
    matches: formMatches,
    cached_at: nowIso,
    season,
    competition_id: competitionId,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickLastFinished(
  all: NormalizedCompetitionMatch[],
  teamId: number,
  window: number
): FormMatch[] {
  const finished = all
    .filter(
      (m) =>
        m.status === 'FT' &&
        m.score.home !== null &&
        m.score.away !== null &&
        (m.homeTeam.id === teamId || m.awayTeam.id === teamId)
    )
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, window)

  return finished.map((m) => {
    const home = m.score.home as number
    const away = m.score.away as number
    const isHome = m.homeTeam.id === teamId
    const teamScore = isHome ? home : away
    const oppScore = isHome ? away : home

    let result: 'W' | 'D' | 'L'
    if (teamScore > oppScore) result = 'W'
    else if (teamScore < oppScore) result = 'L'
    else result = 'D'

    return {
      match_id: m.id,
      utcDate: m.utcDate,
      matchday: m.matchday,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      score: { home, away },
      result,
    }
  })
}
