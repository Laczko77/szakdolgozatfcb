import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Match } from '@/types/database'

/**
 * GET /api/matches
 *
 * Public list of FC Barcelona matches.
 *
 * Query params:
 *   - scope=upcoming (default) | past | all
 *   - limit  (1..100, default 20)
 *
 * Sort order:
 *   - upcoming: ascending by date
 *   - past:     descending by date
 *   - all:      ascending by date
 */

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const SCOPES = ['upcoming', 'past', 'all'] as const
type Scope = (typeof SCOPES)[number]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const scopeRaw = searchParams.get('scope') ?? 'upcoming'
  if (!(SCOPES as readonly string[]).includes(scopeRaw)) {
    return errorResponse('Érvénytelen scope', 400)
  }
  const scope = scopeRaw as Scope

  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)

  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  let query = supabase.from('matches').select('*').limit(limit)

  if (scope === 'upcoming') {
    query = query.gte('date', nowIso).order('date', { ascending: true })
  } else if (scope === 'past') {
    query = query.lt('date', nowIso).order('date', { ascending: false })
  } else {
    query = query.order('date', { ascending: true })
  }

  const { data, error } = await query

  if (error) {
    return errorResponse(`Meccsek lekérése sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ matches: (data ?? []) as Match[] })
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}
