import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAdminApi, successResponse } from '@/lib/api-utils'

/**
 * GET /api/admin/analytics/pages
 *
 * Admin-only. Returns the top 20 most-viewed page_paths, optionally
 * restricted to a date range.
 *
 * Query params:
 *   - from  (ISO timestamp, optional)
 *   - to    (ISO timestamp, optional)
 *   - limit (1..100, default 20)
 *
 * When no date filter is supplied we read the pre-aggregated view
 * `page_view_counts_by_path`. With a filter we aggregate the raw
 * `page_views` rows in the date window — the view ignores time.
 */

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type PathRow = {
  page_path: string
  view_count: number
  last_viewed_at: string | null
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const from = parseIsoOrNull(searchParams.get('from'))
  const to = parseIsoOrNull(searchParams.get('to'))
  if (
    (searchParams.get('from') !== null && from === null) ||
    (searchParams.get('to') !== null && to === null)
  ) {
    return errorResponse('Érvénytelen "from"/"to" időbélyeg', 400)
  }
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)

  const supabase = await createClient()

  if (!from && !to) {
    const { data, error } = await supabase
      .from('page_view_counts_by_path' as never)
      .select('*')
      .order('view_count', { ascending: false })
      .limit(limit)

    if (error) {
      return errorResponse(
        `Oldalmegtekintési statisztika lekérése sikertelen: ${error.message}`,
        500
      )
    }
    return successResponse({ pages: (data ?? []) as unknown as PathRow[] })
  }

  // Date-filtered: aggregate raw rows in JS. Page-path cardinality is small
  // enough that this is fine and avoids an extra SQL function.
  let query = supabase
    .from('page_views')
    .select('page_path, created_at')
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error } = await query.limit(100_000)

  if (error) {
    return errorResponse(
      `Oldalmegtekintési statisztika lekérése sikertelen: ${error.message}`,
      500
    )
  }

  const counts = new Map<string, { view_count: number; last_viewed_at: string }>()
  for (const row of (data ?? []) as { page_path: string; created_at: string }[]) {
    const cur = counts.get(row.page_path)
    if (!cur) {
      counts.set(row.page_path, { view_count: 1, last_viewed_at: row.created_at })
    } else {
      cur.view_count += 1
      if (row.created_at > cur.last_viewed_at) cur.last_viewed_at = row.created_at
    }
  }

  const pages: PathRow[] = Array.from(counts.entries())
    .map(([page_path, v]) => ({
      page_path,
      view_count: v.view_count,
      last_viewed_at: v.last_viewed_at,
    }))
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, limit)

  return successResponse({ pages })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseIsoOrNull(raw: string | null): string | null {
  if (raw === null) return null
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString()
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
