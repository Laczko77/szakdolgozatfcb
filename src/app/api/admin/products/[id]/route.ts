import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { deleteFile, uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type { Product, TablesUpdate } from '@/types/database'
import {
  normalizeClearedSale,
  readSaleFields,
  validateSaleFields,
} from '../_sale-form'

/**
 * /api/admin/products/[id]
 *
 * PUT    — admin only, partial update with optional image replacement.
 * DELETE — admin only, removes the product (cascades to variants/cart_items)
 *          and cleans up its image. Note: order_items reference variants with
 *          ON DELETE RESTRICT, so a product cannot be deleted if any variant
 *          appears in an order. Surface that as a 409 Conflict.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// PUT — update (admin)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
  }

  const name = readString(formData, 'name')
  const description = readNullableString(formData, 'description')
  const category = readNullableString(formData, 'category')
  const priceRaw = readString(formData, 'price')
  const image = readFile(formData, 'image')

  let nextPrice: number | undefined
  if (priceRaw !== null) {
    const parsed = Number.parseFloat(priceRaw)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return errorResponse('Érvénytelen ár', 400)
    }
    nextPrice = parsed
  }

  const saleFields = normalizeClearedSale(readSaleFields(formData))

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Termék lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A termék nem található', 404)
  }
  const existing = existingRaw as Product

  let nextImageUrl: string | undefined = undefined
  if (image) {
    try {
      nextImageUrl = await uploadFile(STORAGE_BUCKETS.productImages, image)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
        500
      )
    }
  }

  // Sale-pricing validation needs the *resulting* price after this PUT — i.e.
  // the new price if provided, otherwise the existing one. Without this the
  // admin could lower `price` below an existing `sale_price` (or vice versa).
  const effectivePrice = nextPrice ?? existing.price
  const effectiveSalePrice =
    saleFields.sale_price === undefined
      ? existing.sale_price
      : saleFields.sale_price
  const saleError = validateSaleFields(
    {
      sale_price: effectiveSalePrice,
      sale_starts_at:
        saleFields.sale_starts_at === undefined
          ? existing.sale_starts_at
          : saleFields.sale_starts_at,
      sale_ends_at:
        saleFields.sale_ends_at === undefined
          ? existing.sale_ends_at
          : saleFields.sale_ends_at,
    },
    effectivePrice
  )
  if (saleError) {
    return errorResponse(saleError, 400)
  }

  const update: TablesUpdate<'products'> = {}
  if (name !== null) update.name = name
  if (description !== undefined) update.description = description
  if (category !== undefined) update.category = category
  if (nextPrice !== undefined) update.price = nextPrice
  if (nextImageUrl !== undefined) update.image_url = nextImageUrl
  if (saleFields.sale_price !== undefined) update.sale_price = saleFields.sale_price
  if (saleFields.sale_starts_at !== undefined) update.sale_starts_at = saleFields.sale_starts_at
  if (saleFields.sale_ends_at !== undefined) update.sale_ends_at = saleFields.sale_ends_at

  if (Object.keys(update).length === 0) {
    return errorResponse('Legalább egy mezőt meg kell adni', 400)
  }

  const { data, error } = await supabase
    .from('products')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    if (nextImageUrl) {
      void safeDeleteImage(nextImageUrl)
    }
    return errorResponse(
      `Termék frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  if (nextImageUrl && existing.image_url && existing.image_url !== nextImageUrl) {
    void safeDeleteImage(existing.image_url)
  }

  return successResponse(data as Product)
}

// ---------------------------------------------------------------------------
// DELETE — remove (admin)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Termék lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A termék nem található', 404)
  }
  const existing = existingRaw as Pick<Product, 'image_url'>

  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (deleteError) {
    // FK violation from order_items.variant_id (ON DELETE RESTRICT) — surface
    // as 409 so the admin understands why the delete was refused.
    if (deleteError.code === '23503') {
      return errorResponse(
        'A termék nem törölhető, mert szerepel rendelésekben',
        409
      )
    }
    return errorResponse(`Termék törlése sikertelen: ${deleteError.message}`, 500)
  }

  if (existing.image_url) {
    void safeDeleteImage(existing.image_url)
  }

  return NextResponse.json({ success: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeDeleteImage(url: string): Promise<void> {
  try {
    await deleteFile(STORAGE_BUCKETS.productImages, url)
  } catch {
    // Best-effort cleanup; orphans are recoverable later.
  }
}

function readString(form: FormData, key: string): string | null {
  const value = form.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNullableString(
  form: FormData,
  key: string
): string | null | undefined {
  const value = form.get(key)
  if (value === null) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (value instanceof File && value.size > 0) return value
  return null
}
