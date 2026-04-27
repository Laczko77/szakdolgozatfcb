import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'

/**
 * GET /api/products/recommended
 *
 * Public. Returns top-N products ranked by a combination of view count and
 * average review rating, sourced from the `recommended_products` view.
 *
 * Query params:
 *   - limit (1..20, default 6)
 *
 * Ranking is performed in SQL: `score` column from the view (see migration
 * 011) is `view_count * (avg_rating / 5) + avg_rating`. Ties broken by
 * view_count then created_at desc.
 */

const DEFAULT_LIMIT = 6
const MAX_LIMIT = 20

type RecommendedRow = {
  product_id: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  category: string | null
  created_at: string
  view_count: number
  avg_rating: number
  review_count: number
  score: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recommended_products' as never)
    .select('*')
    .order('score', { ascending: false })
    .order('view_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return errorResponse(
      `Ajánlott termékek lekérése sikertelen: ${error.message}`,
      500
    )
  }

  return NextResponse.json({
    products: (data ?? []) as unknown as RecommendedRow[],
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
