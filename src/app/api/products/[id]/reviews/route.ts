import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type { Review, TablesInsert } from '@/types/database'

/**
 * /api/products/[id]/reviews
 *
 * GET  — public, list visible reviews for the product (newest first).
 * POST — authenticated, create a review (1-5 stars + optional comment).
 *        DB enforces UNIQUE (product_id, user_id) — a duplicate POST surfaces
 *        as 409 Conflict.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// GET — list (public)
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: productId } = await context.params
  if (!productId) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(`Értékelések lekérése sikertelen: ${error.message}`, 500)
  }

  const reviews = (data ?? []) as Review[]
  const averageRating =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return NextResponse.json({
    reviews,
    averageRating: Number(averageRating.toFixed(2)),
    reviewCount: reviews.length,
  })
}

// ---------------------------------------------------------------------------
// POST — create (authenticated)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: productId } = await context.params
  if (!productId) return errorResponse('Hiányzó azonosító', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés', 400)
  }
  const candidate = body as Record<string, unknown>

  const ratingRaw = candidate.rating
  const rating =
    typeof ratingRaw === 'number'
      ? ratingRaw
      : typeof ratingRaw === 'string'
        ? Number.parseInt(ratingRaw, 10)
        : NaN
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return errorResponse('Az értékelés 1 és 5 közötti egész szám kell legyen', 400)
  }

  let comment: string | null = null
  if (typeof candidate.comment === 'string') {
    const trimmed = candidate.comment.trim()
    comment = trimmed.length > 0 ? trimmed : null
  }

  const supabase = await createClient()

  // Make sure the product exists — otherwise FK violation surfaces as 500.
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle()
  if (productError) {
    return errorResponse(`Termék lekérése sikertelen: ${productError.message}`, 500)
  }
  if (!product) {
    return errorResponse('A termék nem található', 404)
  }

  const insert: TablesInsert<'reviews'> = {
    product_id: productId,
    user_id: user.id,
    rating,
    comment,
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return errorResponse('Ezt a terméket már értékelted', 409)
    }
    return errorResponse(
      `Értékelés létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Review, 201)
}
