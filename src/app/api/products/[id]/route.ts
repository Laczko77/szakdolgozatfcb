import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Product, ProductVariant, Review } from '@/types/database'

/**
 * /api/products/[id]
 *
 * GET — public, returns the product with its variants, visible reviews, and
 * average rating. 404 if the product does not exist.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (productError) {
    return errorResponse(`Termék lekérése sikertelen: ${productError.message}`, 500)
  }
  if (!product) {
    return errorResponse('A termék nem található', 404)
  }

  const [variantsResult, reviewsResult] = await Promise.all([
    supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', id)
      .order('size', { ascending: true }),
    supabase
      .from('reviews')
      .select('*')
      .eq('product_id', id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false }),
  ])

  if (variantsResult.error) {
    return errorResponse(
      `Variánsok lekérése sikertelen: ${variantsResult.error.message}`,
      500
    )
  }
  if (reviewsResult.error) {
    return errorResponse(
      `Értékelések lekérése sikertelen: ${reviewsResult.error.message}`,
      500
    )
  }

  const variants = (variantsResult.data ?? []) as ProductVariant[]
  const reviews = (reviewsResult.data ?? []) as Review[]

  // averageRating is null when there are no visible reviews — the frontend
  // distinguishes "no rating yet" from "rated 0".
  const averageRating: number | null =
    reviews.length === 0
      ? null
      : Number(
          (
            reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          ).toFixed(2)
        )

  return NextResponse.json({
    product: product as Product,
    variants,
    reviews,
    averageRating,
    reviewCount: reviews.length,
  })
}
