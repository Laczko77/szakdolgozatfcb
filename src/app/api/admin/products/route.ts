import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type {
  Product,
  ProductVariant,
  TablesInsert,
} from '@/types/database'

/**
 * /api/admin/products
 *
 * POST — admin only, creates a product with optional variants and image upload.
 * Accepts multipart/form-data:
 *   - name        (string, required)
 *   - description (string, optional)
 *   - category    (string, optional)
 *   - price       (numeric, required, >= 0)
 *   - image       (File, optional)
 *   - variants    (JSON string, optional) — array of { size?, color?, stock }
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
  const image = readFile(formData, 'image')

  if (!name) return errorResponse('A "name" mező kötelező', 400)
  if (priceRaw === null) return errorResponse('A "price" mező kötelező', 400)

  const price = Number.parseFloat(priceRaw)
  if (!Number.isFinite(price) || price < 0) {
    return errorResponse('Érvénytelen ár', 400)
  }

  let variants: VariantInput[] = []
  if (variantsRaw) {
    const parsed = parseVariants(variantsRaw)
    if (parsed instanceof Error) return errorResponse(parsed.message, 400)
    variants = parsed
  }

  let imageUrl: string | null = null
  if (image) {
    try {
      imageUrl = await uploadFile(STORAGE_BUCKETS.productImages, image)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
        500
      )
    }
  }

  const supabase = await createClient()

  const insert: TablesInsert<'products'> = {
    name,
    description,
    category,
    price,
    image_url: imageUrl,
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !product) {
    return errorResponse(
      `Termék létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
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
      await supabase.from('products').delete().eq('id', (product as Product).id)
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
