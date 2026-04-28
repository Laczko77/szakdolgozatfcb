import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAdminApi, successResponse } from '@/lib/api-utils'

/**
 * GET /api/admin/analytics/products
 *
 * Admin-only. Returns the top 20 most-viewed products, optionally restricted
 * to a date range. Without a filter we read the pre-aggregated
 * `product_view_counts` view (which already joins product display fields);
 * with a filter we aggregate raw `page_views` rows and join product data
 * in a follow-up query.
 *
 * Query params:
 *   - from  (ISO timestamp, optional)
 *   - to    (ISO timestamp, optional)
 *   - limit (1..100, default 20)
 */

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type ProductAnalyticsRow = {
  product_id: string
  name: string
  image_url: string | null
  price: number
  category: string | null
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
      .from('product_view_counts' as never)
      .select('*')
      .order('view_count', { ascending: false })
      .limit(limit)

    if (error) {
      return errorResponse(
        `Termék statisztika lekérése sikertelen: ${error.message}`,
        500
      )
    }
    return successResponse({
      products: (data ?? []) as unknown as ProductAnalyticsRow[],
    })
  }

  // Date-filtered: aggregate raw rows then enrich with product data.
  let query = supabase
    .from('page_views')
    .select('product_id, created_at')
    .not('product_id', 'is', null)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error } = await query

  if (error) {
    return errorResponse(
      `Termék statisztika lekérése sikertelen: ${error.message}`,
      500
    )
  }

  const counts = new Map<string, { view_count: number; last_viewed_at: string }>()
  for (const row of (data ?? []) as {
    product_id: string | null
    created_at: string
  }[]) {
    if (!row.product_id) continue
    const cur = counts.get(row.product_id)
    if (!cur) {
      counts.set(row.product_id, { view_count: 1, last_viewed_at: row.created_at })
    } else {
      cur.view_count += 1
      if (row.created_at > cur.last_viewed_at) cur.last_viewed_at = row.created_at
    }
  }

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1].view_count - a[1].view_count)
    .slice(0, limit)
    .map(([id]) => id)

  if (topIds.length === 0) {
    return successResponse({ products: [] as ProductAnalyticsRow[] })
  }

  type ProductRow = { id: string; name: string; image_url: string | null; price: number; category: string | null }

  const { data: productRows, error: productErr } = await supabase
    .from('products')
    .select('id, name, image_url, price, category')
    .in('id', topIds)

  if (productErr) {
    return errorResponse(
      `Termék adatok lekérése sikertelen: ${productErr.message}`,
      500
    )
  }

  const productById = new Map(
    (productRows as ProductRow[] ?? []).map((p) => [p.id, p])
  )

  const products = topIds
    .map((id): ProductAnalyticsRow | null => {
      const p = productById.get(id)
      const stat = counts.get(id)!
      if (!p) return null
      return {
        product_id: id,
        name: p.name,
        image_url: p.image_url ?? null,
        price: p.price,
        category: p.category ?? null,
        view_count: stat.view_count,
        last_viewed_at: stat.last_viewed_at,
      }
    })
    .filter((x): x is ProductAnalyticsRow => x !== null)

  return successResponse({ products })
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
