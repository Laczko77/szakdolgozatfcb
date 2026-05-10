import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { deleteFile, uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import {
  MAX_IMAGES_PER_PRODUCT,
  toPublicImage,
  type ProductImagePublic,
} from '@/lib/product-images'
import type {
  Product,
  ProductImage,
  ProductVariant,
  TablesInsert,
} from '@/types/database'
import {
  normalizeClearedSale,
  readSaleFields,
  validateSaleFields,
} from './_sale-form'

/**
 * /api/admin/products
 *
 * POST — admin only, creates a product with optional variants and image upload.
 * Accepts multipart/form-data:
 *   - name        (string, required)
 *   - description (string, optional)
 *   - category    (string, optional)
 *   - price       (numeric, required, >= 0)
 *   - image       (File, optional, legacy single-image upload)
 *   - images      (File, repeated under the `images` key, optional)
 *   - cover_index (integer, optional — index in `images[]` that should be
 *                  the cover. Defaults to 0 when any images are uploaded.)
 *   - variants    (JSON string, optional) — array of { size?, color?, stock }
 *   - sale_price  (numeric, optional) — must be > 0 and < price
 *   - sale_starts_at (ISO datetime, optional)
 *   - sale_ends_at   (ISO datetime, optional) — must be > sale_starts_at
 *
 * Sale-pricing rule: if `sale_price` is omitted, the product has no sale.
 * Sending `null` or empty string explicitly also produces no sale (and
 * forces the date fields to null too, regardless of what was sent).
 *
 * Image rule (Iter28): `images[]` and the legacy `image` field are merged.
 * If both are sent, `image` is appended after `images[]`. The cover is
 * determined by `cover_index` over the merged list, defaulting to 0.
 * Maximum MAX_IMAGES_PER_PRODUCT files are accepted.
 */

type VariantInput = {
  size?: string | null
  color?: string | null
  stock: number
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
  }

  const name = readString(formData, 'name')
  const description = readString(formData, 'description')
  const category = readString(formData, 'category')
  const priceRaw = readString(formData, 'price')
  const variantsRaw = readString(formData, 'variants')

  // Iter28: collect every uploaded file from `images[]` plus the legacy
  // `image` field. A single product can have at most MAX_IMAGES_PER_PRODUCT.
  const galleryFiles = readFiles(formData, 'images')
  const legacyImage = readFile(formData, 'image')
  const allFiles: File[] = legacyImage
    ? [...galleryFiles, legacyImage]
    : galleryFiles

  if (allFiles.length > MAX_IMAGES_PER_PRODUCT) {
    return errorResponse(
      `Egy termékhez maximum ${MAX_IMAGES_PER_PRODUCT} kép tartozhat`,
      400
    )
  }

  const coverIndex = readCoverIndex(formData, allFiles.length)
  if (coverIndex instanceof Error) {
    return errorResponse(coverIndex.message, 400)
  }

  if (!name) return errorResponse('A "name" mező kötelező', 400)
  if (priceRaw === null) return errorResponse('A "price" mező kötelező', 400)

  const price = Number.parseFloat(priceRaw)
  if (!Number.isFinite(price) || price < 0) {
    return errorResponse('Érvénytelen ár', 400)
  }

  const saleFields = normalizeClearedSale(readSaleFields(formData))
  const saleError = validateSaleFields(saleFields, price)
  if (saleError) {
    return errorResponse(saleError, 400)
  }

  let variants: VariantInput[] = []
  if (variantsRaw) {
    const parsed = parseVariants(variantsRaw)
    if (parsed instanceof Error) return errorResponse(parsed.message, 400)
    variants = parsed
  }

  // Upload every file up-front. We roll back the uploaded blobs if the
  // subsequent DB inserts fail.
  const uploadedUrls: string[] = []
  try {
    for (const file of allFiles) {
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

  // Cover defaults to index 0 when any images were uploaded; if no images
  // were provided, the product has no cover and `image_url` stays NULL.
  const effectiveCoverIndex: number | null =
    uploadedUrls.length === 0 ? null : (coverIndex ?? 0)
  const coverUrl =
    effectiveCoverIndex !== null ? uploadedUrls[effectiveCoverIndex] : null

  const supabase = await createClient()

  const insert: TablesInsert<'products'> = {
    name,
    description,
    category,
    price,
    // The cover URL is mirrored into product_images below; the trigger keeps
    // products.image_url in sync going forward, so we pre-fill it here too.
    image_url: coverUrl,
    sale_price: saleFields.sale_price ?? null,
    sale_starts_at: saleFields.sale_starts_at ?? null,
    sale_ends_at: saleFields.sale_ends_at ?? null,
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !product) {
    await Promise.all(uploadedUrls.map((u) => safeDeleteImage(u)))
    return errorResponse(
      `Termék létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  // Iter28 — write the gallery rows. The first image (or `cover_index`)
  // becomes the cover. The trigger on `product_images` will reaffirm the
  // legacy `products.image_url` to match.
  let images: ProductImagePublic[] = []
  if (uploadedUrls.length > 0) {
    const imageInserts: TablesInsert<'product_images'>[] = uploadedUrls.map(
      (url, idx) => ({
        product_id: (product as Product).id,
        image_url: url,
        display_order: idx,
        is_cover: idx === effectiveCoverIndex,
      })
    )

    const { data: imageRows, error: imageError } = await supabase
      .from('product_images')
      .insert(imageInserts as never)
      .select('*')

    if (imageError) {
      await supabase.from('products').delete().eq('id', (product as Product).id)
      await Promise.all(uploadedUrls.map((u) => safeDeleteImage(u)))
      return errorResponse(
        `Képek mentése sikertelen: ${imageError.message}`,
        500
      )
    }

    images = (imageRows as ProductImage[])
      .sort((a, b) => a.display_order - b.display_order)
      .map(toPublicImage)
  }

  let createdVariants: ProductVariant[] = []
  if (variants.length > 0) {
    const variantInserts: TablesInsert<'product_variants'>[] = variants.map(
      (v) => ({
        product_id: (product as Product).id,
        size: v.size ?? null,
        color: v.color ?? null,
        stock: v.stock,
      })
    )

    const { data: variantRows, error: variantError } = await supabase
      .from('product_variants')
      .insert(variantInserts as never)
      .select('*')

    if (variantError) {
      // Best-effort: roll back the product so we don't end up with a product
      // that has no variants when the admin clearly intended otherwise.
      // The product DELETE cascades to product_images; we still remove the
      // Storage blobs because the cascade only touches DB rows.
      await supabase.from('products').delete().eq('id', (product as Product).id)
      await Promise.all(uploadedUrls.map((u) => safeDeleteImage(u)))
      return errorResponse(
        `Variánsok létrehozása sikertelen: ${variantError.message}`,
        500
      )
    }

    createdVariants = (variantRows ?? []) as ProductVariant[]
  }

  return successResponse(
    {
      product: product as Product,
      variants: createdVariants,
      images,
    },
    201
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseVariants(raw: string): VariantInput[] | Error {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return new Error('A "variants" mező érvénytelen JSON')
  }

  if (!Array.isArray(parsed)) {
    return new Error('A "variants" mezőnek tömbnek kell lennie')
  }

  const result: VariantInput[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      return new Error('Érvénytelen variáns elem')
    }
    const candidate = item as Record<string, unknown>
    const stockRaw = candidate.stock
    const stock =
      typeof stockRaw === 'number'
        ? stockRaw
        : typeof stockRaw === 'string'
          ? Number.parseInt(stockRaw, 10)
          : NaN
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      return new Error('Érvénytelen készlet érték a variánsban')
    }
    const size =
      typeof candidate.size === 'string' && candidate.size.trim().length > 0
        ? candidate.size.trim()
        : null
    const color =
      typeof candidate.color === 'string' && candidate.color.trim().length > 0
        ? candidate.color.trim()
        : null
    result.push({ size, color, stock })
  }

  return result
}

function readString(form: FormData, key: string): string | null {
  const value = form.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (value instanceof File && value.size > 0) return value
  return null
}

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
  if (fileCount === 0) {
    return new Error('"cover_index" csak képek mellett értelmezhető')
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
