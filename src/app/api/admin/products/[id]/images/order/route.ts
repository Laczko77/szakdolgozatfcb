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
 * /api/admin/products/[id]/images/order
 *
 * PUT — admin only. Body: JSON array
 *   [{ "image_id": "<uuid>", "display_order": 0 }, ...]
 *
 * Every image_id must exist on the product. The list does not have to cover
 * every image — only the listed images are repositioned. Display orders are
 * applied as-is; the caller is responsible for keeping them coherent.
 *
 * Returns the gallery in display_order ASC after the update.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

type OrderItem = {
  image_id: string
  display_order: number
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: productId } = await context.params
  if (!productId) return errorResponse('Hiányzó termék azonosító', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON', 400)
  }

  const items = parseOrderItems(body)
  if (items instanceof Error) {
    return errorResponse(items.message, 400)
  }
  if (items.length === 0) {
    return errorResponse('Legalább egy elemet meg kell adni', 400)
  }

  const supabase = await createClient()

  // Verify every image_id belongs to this product.
  const ids = items.map((i) => i.image_id)
  const { data: existing, error: existingError } = await supabase
    .from('product_images')
    .select('id, product_id')
    .in('id', ids)

  if (existingError) {
    return errorResponse(
      `Képek ellenőrzése sikertelen: ${existingError.message}`,
      500
    )
  }
  const existingRows = (existing ?? []) as Array<
    Pick<ProductImage, 'id' | 'product_id'>
  >
  if (existingRows.length !== ids.length) {
    return errorResponse('Egy vagy több kép nem található', 404)
  }
  for (const row of existingRows) {
    if (row.product_id !== productId) {
      return errorResponse('Egy kép nem ehhez a termékhez tartozik', 400)
    }
  }

  // Apply updates one row at a time. The list is small (<= 10 items), so
  // a single round-trip per item is acceptable. We don't wrap this in a
  // transaction because the "max 1 cover" invariant isn't touched by
  // display_order updates.
  for (const item of items) {
    const { error: updateError } = await supabase
      .from('product_images')
      .update({ display_order: item.display_order } as never)
      .eq('id', item.image_id)

    if (updateError) {
      return errorResponse(
        `Sorrend mentése sikertelen: ${updateError.message}`,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOrderItems(raw: unknown): OrderItem[] | Error {
  if (!Array.isArray(raw)) {
    return new Error('A test egy tömb kell legyen')
  }
  const seen = new Set<string>()
  const result: OrderItem[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      return new Error('Érvénytelen sorrend elem')
    }
    const candidate = entry as Record<string, unknown>
    const imageId = candidate.image_id
    const displayOrder = candidate.display_order
    if (typeof imageId !== 'string' || imageId.length === 0) {
      return new Error('Érvénytelen "image_id"')
    }
    if (
      typeof displayOrder !== 'number' ||
      !Number.isInteger(displayOrder) ||
      displayOrder < 0
    ) {
      return new Error('Érvénytelen "display_order"')
    }
    if (seen.has(imageId)) {
      return new Error('Ismétlődő "image_id" a listában')
    }
    seen.add(imageId)
    result.push({ image_id: imageId, display_order: displayOrder })
  }
  return result
}
