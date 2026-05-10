import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import {
  fetchProductGallery,
  type ProductImagePublic,
} from '@/lib/product-images'
import type { ProductImage } from '@/types/database'

/**
 * /api/admin/products/[id]/images/[imageId]/cover
 *
 * PUT — admin only. Marks the given image as the cover. The single-cover
 * invariant is enforced at the DB layer (BEFORE INSERT/UPDATE trigger that
 * clears `is_cover` on every other image of the product before the new row
 * is committed). This keeps the partial unique index from rejecting the
 * statement when two TRUE rows would briefly coexist.
 *
 * The trigger that mirrors `products.image_url` automatically updates the
 * legacy column so backward-compat readers (BE 24/25 paths) keep working.
 */

type RouteContext = {
  params: Promise<{ id: string; imageId: string }>
}

export async function PUT(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: productId, imageId } = await context.params
  if (!productId || !imageId) {
    return errorResponse('Hiányzó azonosító', 400)
  }

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('product_images')
    .select('id, product_id, is_cover')
    .eq('id', imageId)
    .maybeSingle()

  if (fetchError) {
    if (fetchError.code === '22P02') {
      return errorResponse('A kép nem található', 404)
    }
    return errorResponse(`Kép lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A kép nem található', 404)
  }
  const existing = existingRaw as Pick<
    ProductImage,
    'id' | 'product_id' | 'is_cover'
  >
  if (existing.product_id !== productId) {
    return errorResponse('A kép nem ehhez a termékhez tartozik', 404)
  }

  if (!existing.is_cover) {
    const { error: updateError } = await supabase
      .from('product_images')
      .update({ is_cover: true } as never)
      .eq('id', imageId)

    if (updateError) {
      return errorResponse(
        `Cover beállítása sikertelen: ${updateError.message}`,
        500
      )
    }
  }

  let gallery: ProductImagePublic[]
  try {
    gallery = await fetchProductGallery(supabase, productId)
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : 'Galéria lekérése sikertelen',
      500
    )
  }

  return successResponse({ images: gallery })
}
