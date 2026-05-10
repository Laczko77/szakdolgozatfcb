import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-utils'
import {
  FootballDataConfigError,
  FootballDataRequestError,
  LA_LIGA_COMPETITION_ID,
  currentSeasonStartYear,
} from '@/lib/football-data'

/**
 * Helpers shared by the four `/api/season/...` route handlers.
 *
 * Underscore-prefixed file name keeps Next.js from treating it as a route.
 */

/**
 * Resolve a `competition` query-string param into a numeric ID.
 *
 * Accepts: missing (default = 2014), the alias `laliga`, or a literal
 * numeric ID. Returns null on an unknown alias so the caller can return a
 * 400 with a Hungarian message.
 */
export function parseCompetition(raw: string | null): number | null {
  if (!raw) return LA_LIGA_COMPETITION_ID
  const lower = raw.toLowerCase()
  if (lower === 'laliga') return LA_LIGA_COMPETITION_ID
  const parsed = Number.parseInt(lower, 10)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

export function parseSeason(raw: string | null): number {
  if (!raw) return currentSeasonStartYear()
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return currentSeasonStartYear()
  }
  return parsed
}

export function parseTeamId(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return parsed
}

export function parseLimit(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export function isFresh(cachedAtIso: string, ttlMs: number): boolean {
  const cachedAt = new Date(cachedAtIso).getTime()
  if (Number.isNaN(cachedAt)) return false
  return Date.now() - cachedAt < ttlMs
}

/**
 * Map a thrown football-data.org error to a NextResponse with a stable,
 * user-friendly Hungarian message. Mirrors the pattern used by
 * /api/standings and /api/scorers.
 */
export function mapUpstreamError(err: unknown): NextResponse {
  if (err instanceof FootballDataConfigError) {
    return errorResponse(
      'A football-data.org API kulcs nincs beállítva (FOOTBALL_DATA_API_KEY)',
      503
    )
  }
  if (err instanceof FootballDataRequestError) {
    return errorResponse(
      `football-data.org nem elérhető: ${err.message}`,
      err.status === 429 ? 429 : 503
    )
  }
  return errorResponse(
    err instanceof Error
      ? `football-data.org hiba: ${err.message}`
      : 'football-data.org hiba',
    503
  )
}

/** Cache key composer — keeps cache_key strings consistent across routes. */
export function buildCacheKey(parts: Array<string | number>): string {
  return parts.map((p) => String(p)).join('|')
}
