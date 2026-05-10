import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  fetchProductViewCounts,
  getTopProductIds,
  viewCountMap,
  type ViewCountRow,
} from '@/lib/product-popularity'
import { computeSalePricing } from '@/lib/sale-pricing'
import {
  fetchCoverImagesByProductIds,
  type ProductImagePublic,
} from '@/lib/product-images'
import type { Product } from '@/types/database'

/**
 * /api/products
 *
 * GET — public, paginated list with optional filters:
 *   - category (string)
 *   - search   (string, ILIKE on name + description)
 *   - minPrice / maxPrice (numeric)
 *   - page / limit (pagination)
 *   - sort     ('newest' | 'popular' | 'price_asc' | 'price_desc';
 *              default 'newest', backwards-compatible)
 *
 * Each returned product carries `average_rating` (number | null) and
 * `review_count` (number) computed from `reviews` rows where
 * `is_visible = true`. `average_rating` is null when the product has no
 * visible reviews — the frontend distinguishes "no rating yet" from "rated 0".
 *
 * Iter24: every product also carries `view_count` (number, 0 if none) and
 * the response payload includes `top_products` — the IDs of the three
 * globally most-viewed products, independent of pagination/filters. The
 * frontend uses this to badge top-3 cards.
 */

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 50

const SORT_VALUES = ['newest', 'popular', 'price_asc', 'price_desc'] as const
type SortKey = (typeof SORT_VALUES)[number]

export type ProductWithRating = Product & {
  average_rating: number | null
  review_count: number
  view_count: number
  // Iter25: server-computed sale fields. Frontend renders price vs.
  // strikethrough using `is_on_sale` and `effective_price`.
  effective_price: number
  is_on_sale: boolean
  // Iter28: gallery. The list endpoint only includes the cover image to keep
  // the payload small — call /api/products/[id] for the full gallery.
  images: ProductImagePublic[]
}

type ProductFilters = {
  category: string | null
  search: string | null
  minPrice: number | null
  maxPrice: number | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const page = clampInt(searchParams.get('page'), DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)

  const sort = parseSort(searchParams.get('sort'))
  if (sort === null) {
    return errorResponse('Érvénytelen "sort" érték', 400)
  }

  const minPrice = parseFloatOrNull(searchParams.get('minPrice'))
  const maxPrice = parseFloatOrNull(searchParams.get('maxPrice'))
  if (
    (searchParams.get('minPrice') !== null && minPrice === null) ||
    (searchParams.get('maxPrice') !== null && maxPrice === null)
  ) {
    return errorResponse('Érvénytelen ár szűrő', 400)
  }

  const filters: ProductFilters = {
    category: searchParams.get('category'),
    search: searchParams.get('search'),
    minPrice,
    maxPrice,
  }

  const supabase = await createClient()

  // ---- Popularity aggregate (used by both the response and 'popular' sort)
  // 'popular' needs the full aggregate to rank globally; other sorts only
  // need the top-3 (cached) and a per-page lookup (also fetched once).
  let viewRows: ViewCountRow[] | null = null
  if (sort === 'popular') {
    viewRows = await fetchProductViewCounts(supabase)
  }
  const topProducts = await getTopProductIds(supabase, viewRows ?? undefined)

  let products: Product[] = []
  let total = 0

  if (sort === 'popular') {
    // Aggregate-driven path: fetch every product matching the filters, rank
    // by view_count (then created_at desc as tie-breaker), paginate the
    // ranked list, then return the page in rank order. Products never viewed
    // are appended after viewed ones so the catalogue remains discoverable.
    const filtered = await fetchFilteredProductIds(supabase, filters)
    if (filtered === null) {
      return errorResponse('Termékek lekérése sikertelen', 500)
    }

    const counts = viewCountMap(viewRows ?? [])
    const ranked = [...filtered].sort((a, b) => {
      const va = counts.get(a.id) ?? 0
      const vb = counts.get(b.id) ?? 0
      if (vb !== va) return vb - va
      return a.created_at < b.created_at ? 1 : -1
    })

    total = ranked.length
    const from = (page - 1) * limit
    const pageIds = ranked.slice(from, from + limit).map((r) => r.id)

    if (pageIds.length === 0) {
      products = []
    } else {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', pageIds)
      if (error) {
        return errorResponse(`Termékek lekérése sikertelen: ${error.message}`, 500)
      }
      // `.in()` returns DB-ordered rows; restore the ranked order for output.
      const byId = new Map((data as Product[]).map((p) => [p.id, p]))
      products = pageIds
        .map((id) => byId.get(id))
        .filter((p): p is Product => p !== undefined)
    }
  } else {
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .range(from, to)

    if (filters.category) query = query.eq('category', filters.category)
    if (filters.minPrice !== null) query = query.gte('price', filters.minPrice)
    if (filters.maxPrice !== null) query = query.lte('price', filters.maxPrice)
    if (filters.search) {
      const escaped = filters.search.replace(/[%_]/g, (m) => `\\${m}`)
      query = query.or(
        `name.ilike.%${escaped}%,description.ilike.%${escaped}%`
      )
    }

    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true })
        break
      case 'price_desc':
        query = query.order('price', { ascending: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    const { data, error, count } = await query
    if (error) {
      return errorResponse(`Termékek lekérése sikertelen: ${error.message}`, 500)
    }
    products = (data ?? []) as Product[]
    total = count ?? 0
  }

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  // ---- Aggregate visible review ratings for the current page -------------
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

  // ---- View counts for the current page ----------------------------------
  // 'popular' already has the full aggregate; for other sorts we fetch it
  // once per request only when the page actually has products.
  let pageViewCounts: Map<string, number>
  if (viewRows) {
    pageViewCounts = viewCountMap(viewRows)
  } else if (productIds.length > 0) {
    pageViewCounts = viewCountMap(await fetchProductViewCounts(supabase))
  } else {
    pageViewCounts = new Map()
  }

  // ---- Cover images for the current page ---------------------------------
  // The list endpoint intentionally returns only the cover (single row per
  // product). The detail endpoint /api/products/[id] returns the full
  // gallery. This keeps catalogue payloads small while still letting the
  // frontend render multi-image cards by following the detail link.
  let coverImages: Map<string, ProductImagePublic>
  try {
    coverImages = await fetchCoverImagesByProductIds(supabase, productIds)
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : 'Képek lekérése sikertelen',
      500
    )
  }

  const enriched: ProductWithRating[] = products.map((p) => {
    const bucket = ratingsByProductId.get(p.id)
    const view_count = pageViewCounts.get(p.id) ?? 0
    const sale = computeSalePricing(p)
    const ratingFields =
      !bucket || bucket.count === 0
        ? { average_rating: null as number | null, review_count: 0 }
        : {
            average_rating: Number((bucket.sum / bucket.count).toFixed(2)),
            review_count: bucket.count,
          }
    const cover = coverImages.get(p.id)
    return {
      ...p,
      ...ratingFields,
      view_count,
      effective_price: sale.effective_price,
      is_on_sale: sale.is_on_sale,
      images: cover ? [cover] : [],
    }
  })

  return NextResponse.json({
    products: enriched,
    total,
    page,
    totalPages,
    top_products: topProducts,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSort(raw: string | null): SortKey | null {
  if (raw === null) return 'newest'
  return (SORT_VALUES as readonly string[]).includes(raw)
    ? (raw as SortKey)
    : null
}

/**
 * Fetch every product (id + created_at only) matching the current filters,
 * for the 'popular' sort path. Returns null on error.
 */
async function fetchFilteredProductIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: ProductFilters
): Promise<Array<{ id: string; created_at: string }> | null> {
  let q = supabase.from('products').select('id, created_at')
  if (filters.category) q = q.eq('category', filters.category)
  if (filters.minPrice !== null) q = q.gte('price', filters.minPrice)
  if (filters.maxPrice !== null) q = q.lte('price', filters.maxPrice)
  if (filters.search) {
    const escaped = filters.search.replace(/[%_]/g, (m) => `\\${m}`)
    q = q.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }
  const { data, error } = await q
  if (error) return null
  return (data ?? []) as Array<{ id: string; created_at: string }>
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

function parseFloatOrNull(raw: string | null): number | null {
  if (raw === null) return null
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}
