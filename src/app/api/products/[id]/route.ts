import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import {
  fetchProductViewCounts,
  getTopProductIds,
  viewCountMap,
} from '@/lib/product-popularity'
import { computeSalePricing } from '@/lib/sale-pricing'
import { fetchProductGallery } from '@/lib/product-images'
import type { Product, ProductVariant, Review } from '@/types/database'

/**
 * /api/products/[id]
 *
 * GET — public, returns the product with its variants, visible reviews, and
 * average rating. 404 if the product does not exist.
 *
 * Iter24: response also carries `view_count` (number, 0 if never viewed) and
 * `is_top_3` (boolean — true if this product is currently among the three
 * most-viewed in the catalogue). The top-3 set is shared with the listing
 * endpoint via an in-process TTL cache.
 *
 * Iter28: response includes `product.images` — the ordered gallery
 * (display_order ASC). The legacy `product.image_url` is kept in sync with
 * the cover image by a DB trigger, so existing single-image consumers keep
 * working.
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

  const [variantsResult, reviewsResult, viewRows, topProducts, galleryResult] =
    await Promise.all([
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
      fetchProductViewCounts(supabase),
      getTopProductIds(supabase),
      fetchProductGallery(supabase, id).catch((err) => err as Error),
    ])

  if (galleryResult instanceof Error) {
    return errorResponse(
      `Képek lekérése sikertelen: ${galleryResult.message}`,
      500
    )
  }

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

  const viewCount = viewCountMap(viewRows).get(id) ?? 0
  const isTop3 = topProducts.includes(id)

  const productRow = product as Product
  const sale = computeSalePricing(productRow)

  return NextResponse.json({
    product: {
      ...productRow,
      effective_price: sale.effective_price,
      is_on_sale: sale.is_on_sale,
      images: galleryResult,
    },
    variants,
    reviews,
    averageRating,
    reviewCount: reviews.length,
    view_count: viewCount,
    is_top_3: isTop3,
  })
}
