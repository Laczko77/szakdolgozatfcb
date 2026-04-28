import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Product } from '@/types/database'

/**
 * /api/products
 *
 * GET — public, paginated list with optional filters:
 *   - category (string)
 *   - search   (string, ILIKE on name + description)
 *   - minPrice / maxPrice (numeric)
 *   - page / limit (pagination)
 *
 * Each returned product carries `average_rating` (number | null) and
 * `review_count` (number) computed from `reviews` rows where
 * `is_visible = true`. `average_rating` is null when the product has no
 * visible reviews — the frontend distinguishes "no rating yet" from "rated 0".
 */

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 50

export type ProductWithRating = Product & {
  average_rating: number | null
  review_count: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const page = clampInt(searchParams.get('page'), DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  const minPrice = parseFloatOrNull(searchParams.get('minPrice'))
  const maxPrice = parseFloatOrNull(searchParams.get('maxPrice'))
  if (
    (searchParams.get('minPrice') !== null && minPrice === null) ||
    (searchParams.get('maxPrice') !== null && maxPrice === null)
  ) {
    return errorResponse('Érvénytelen ár szűrő', 400)
  }

  const supabase = await createClient()

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (category) query = query.eq('category', category)
  if (minPrice !== null) query = query.gte('price', minPrice)
  if (maxPrice !== null) query = query.lte('price', maxPrice)
  if (search) {
    // Escape % and _ to keep them literal; supabase-js ILIKE wildcards otherwise.
    const escaped = search.replace(/[%_]/g, (m) => `\\${m}`)
    query = query.or(
      `name.ilike.%${escaped}%,description.ilike.%${escaped}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    return errorResponse(`Termékek lekérése sikertelen: ${error.message}`, 500)
  }

  const products = (data ?? []) as Product[]
  const total = count ?? 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  // ---- Aggregate visible review ratings for the current page -------------
  // One round-trip: fetch every visible review tied to any product on this
  // page, then group in JS. Cheaper than N detail queries and avoids a
  // Postgres view dependency.
  const productIds = products.map((p) => p.id)
  const ratingsByProductId = new Map<
    string,
    { sum: number; count: number }
  >()

  if (productIds.length > 0) {
    const { data: reviewRows, error: reviewError } = await supabase
      .from('reviews')
      .select('product_id, rating')
      .in('product_id', productIds)
      .eq('is_visible', true)

    if (reviewError) {
      return errorResponse(
        `Értékelések aggregációja sikertelen: ${reviewError.message}`,
        500
      )
    }

    for (const row of (reviewRows ?? []) as Array<{
      product_id: string
      rating: number
    }>) {
      const bucket = ratingsByProductId.get(row.product_id) ?? {
        sum: 0,
        count: 0,
      }
      bucket.sum += row.rating
      bucket.count += 1
      ratingsByProductId.set(row.product_id, bucket)
    }
  }

  const enriched: ProductWithRating[] = products.map((p) => {
    const bucket = ratingsByProductId.get(p.id)
    if (!bucket || bucket.count === 0) {
      return { ...p, average_rating: null, review_count: 0 }
    }
    return {
      ...p,
      average_rating: Number((bucket.sum / bucket.count).toFixed(2)),
      review_count: bucket.count,
    }
  })

  return NextResponse.json({
    products: enriched,
    total,
    page,
    totalPages,
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

function parseFloatOrNull(raw: string | null): number | null {
  if (raw === null) return null
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}
