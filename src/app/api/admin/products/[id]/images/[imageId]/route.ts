import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAdminApi } from '@/lib/api-utils'
import { deleteFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type { ProductImage } from '@/types/database'

/**
 * /api/admin/products/[id]/images/[imageId]
 *
 * DELETE — admin only. Removes the image both from the DB and from Storage.
 *
 * If the deleted row is the current cover, the AFTER DELETE trigger on
 * `product_images` automatically promotes the lowest-display_order survivor
 * to cover (or NULLs `products.image_url` if the product has no images
 * left). The trigger logic lives in migration 024.
 */

type RouteContext = {
  params: Promise<{ id: string; imageId: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: productId, imageId } = await context.params
  if (!productId || !imageId) {
    return errorResponse('Hiányzó azonosító', 400)
  }

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('product_images')
    .select('id, product_id, image_url')
    .eq('id', imageId)
    .maybeSingle()

  if (fetchError) {
    // 22P02 = invalid uuid syntax — surface as 404 like the rest of the API.
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
    'id' | 'product_id' | 'image_url'
  >

  if (existing.product_id !== productId) {
    return errorResponse('A kép nem ehhez a termékhez tartozik', 404)
  }

  const { error: deleteError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId)

  if (deleteError) {
    return errorResponse(
      `Kép törlése sikertelen: ${deleteError.message}`,
      500
    )
  }

  await safeDeleteImage(existing.image_url)

  return NextResponse.json({ success: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeDeleteImage(url: string): Promise<void> {
  try {
    await deleteFile(STORAGE_BUCKETS.productImages, url)
  } catch {
    // Best-effort — orphans are recoverable later.
  }
}
