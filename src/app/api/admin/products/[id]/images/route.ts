import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { uploadFile, deleteFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import {
  MAX_IMAGES_PER_PRODUCT,
  toPublicImage,
  type ProductImagePublic,
} from '@/lib/product-images'
import type { ProductImage, TablesInsert } from '@/types/database'

/**
 * /api/admin/products/[id]/images
 *
 * POST — admin only. Accepts multipart/form-data with:
 *   - images       (File, repeated under the `images` key — required, >=1)
 *   - cover_index  (string number, optional — index in the uploaded array
 *                   that should become the cover. Defaults to 0 only when
 *                   the product currently has no cover; otherwise no upload
 *                   becomes the cover unless explicitly requested.)
 *
 * Each image is uploaded to the `product-images` Storage bucket, then a row
 * per image is inserted into `product_images`. We never exceed
 * MAX_IMAGES_PER_PRODUCT total images per product — the limit considers
 * existing rows.
 *
 * On any DB failure after Storage uploads succeed, we best-effort delete the
 * just-uploaded files so we don't leak orphans.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: productId } = await context.params
  if (!productId) return errorResponse('Hiányzó termék azonosító', 400)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
  }

  const files = readFiles(formData, 'images')
  if (files.length === 0) {
    return errorResponse('Legalább egy képet meg kell adni', 400)
  }

  const coverIndex = readCoverIndex(formData, files.length)
  if (coverIndex instanceof Error) {
    return errorResponse(coverIndex.message, 400)
  }

  const supabase = await createClient()

  // Verify the product exists and count current images in one round-trip.
  const { data: productRow, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle()

  if (productError) {
    return errorResponse(
      `Termék ellenőrzése sikertelen: ${productError.message}`,
      500
    )
  }
  if (!productRow) {
    return errorResponse('A termék nem található', 404)
  }

  const { data: existing, error: existingError } = await supabase
    .from('product_images')
    .select('id, display_order, is_cover')
    .eq('product_id', productId)
    .order('display_order', { ascending: false })
    .limit(MAX_IMAGES_PER_PRODUCT + 1)

  if (existingError) {
    return errorResponse(
      `Képek lekérése sikertelen: ${existingError.message}`,
      500
    )
  }

  const existingRows = (existing ?? []) as Array<
    Pick<ProductImage, 'id' | 'display_order' | 'is_cover'>
  >

  if (existingRows.length + files.length > MAX_IMAGES_PER_PRODUCT) {
    return errorResponse(
      `Egy termékhez maximum ${MAX_IMAGES_PER_PRODUCT} kép tartozhat`,
      400
    )
  }

  const hasExistingCover = existingRows.some((r) => r.is_cover)
  const nextOrderStart =
    existingRows.length === 0 ? 0 : existingRows[0].display_order + 1

  // Upload all files first. If any fails, roll back already-uploaded URLs.
  const uploadedUrls: string[] = []
  try {
    for (const file of files) {
      const url = await uploadFile(STORAGE_BUCKETS.productImages, file)
      uploadedUrls.push(url)
    }
  } catch (err) {
    await Promise.all(uploadedUrls.map((u) => safeDeleteImage(u)))
    return errorResponse(
      err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
      500
    )
  }

  // Decide which uploaded image becomes the cover.
  // - explicit cover_index wins
  // - otherwise: if the product had no cover yet, use the first upload
  // - otherwise: keep the existing cover untouched
  const requestedCover = coverIndex
  const coverPick: number | null =
    requestedCover !== null
      ? requestedCover
      : hasExistingCover
        ? null
        : 0

  const inserts: TablesInsert<'product_images'>[] = files.map((_, idx) => ({
    product_id: productId,
    image_url: uploadedUrls[idx],
    display_order: nextOrderStart + idx,
    is_cover: coverPick === idx,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('product_images')
    .insert(inserts as never)
    .select('*')

  if (insertError || !inserted) {
    await Promise.all(uploadedUrls.map((u) => safeDeleteImage(u)))
    return errorResponse(
      `Képek mentése sikertelen: ${insertError?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  const images: ProductImagePublic[] = (inserted as ProductImage[])
    .sort((a, b) => a.display_order - b.display_order)
    .map(toPublicImage)

  return successResponse({ images }, 201)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFiles(form: FormData, key: string): File[] {
  const result: File[] = []
  for (const value of form.getAll(key)) {
    if (value instanceof File && value.size > 0) {
      result.push(value)
    }
  }
  return result
}

function readCoverIndex(form: FormData, fileCount: number): number | null | Error {
  const raw = form.get('cover_index')
  if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return null
  }
  if (typeof raw !== 'string') {
    return new Error('Érvénytelen "cover_index" érték')
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= fileCount) {
    return new Error('Érvénytelen "cover_index" érték')
  }
  return parsed
}

async function safeDeleteImage(url: string): Promise<void> {
  try {
    await deleteFile(STORAGE_BUCKETS.productImages, url)
  } catch {
    // Best-effort — orphans are recoverable later.
  }
}
