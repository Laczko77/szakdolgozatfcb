import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type {
  ProductVariant,
  TablesInsert,
  TablesUpdate,
} from '@/types/database'

/**
 * /api/admin/products/[id]/variants
 *
 * POST   — admin only, add a new variant to an existing product.
 *          Body (JSON): { size?, color?, stock }
 *
 * PUT    — admin only, bulk update variants for the product. Body (JSON):
 *          { variants: Array<{ id?, size?, color?, stock }> }
 *          - items with `id` are updated in place
 *          - items without `id` are inserted as new variants
 *          - existing variants NOT included in the payload are left untouched
 *
 * DELETE — admin only, remove a single variant. Variant id passed via
 *          ?variantId=... query parameter. Returns 409 if the variant is
 *          already referenced by order_items.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

type VariantPayload = {
  id?: string
  size?: string | null
  color?: string | null
  stock: number
}

// ---------------------------------------------------------------------------
// POST — add a single variant
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: productId } = await context.params
  if (!productId) return errorResponse('Hiányzó termék azonosító', 400)

  const body = await readJson(request)
  if (body instanceof NextResponse) return body

  const parsed = parseVariant(body)
  if (parsed instanceof Error) return errorResponse(parsed.message, 400)

  const supabase = await createClient()

  const productExists = await ensureProductExists(supabase, productId)
  if (productExists instanceof NextResponse) return productExists

  const insert: TablesInsert<'product_variants'> = {
    product_id: productId,
    size: parsed.size ?? null,
    color: parsed.color ?? null,
    stock: parsed.stock,
  }

  const { data, error } = await supabase
    .from('product_variants')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Variáns létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as ProductVariant, 201)
}

// ---------------------------------------------------------------------------
// PUT — bulk upsert (update existing + insert new)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: productId } = await context.params
  if (!productId) return errorResponse('Hiányzó termék azonosító', 400)

  const body = await readJson(request)
  if (body instanceof NextResponse) return body

  if (
    typeof body !== 'object' ||
    body === null ||
    !('variants' in body) ||
    !Array.isArray((body as { variants: unknown }).variants)
  ) {
    return errorResponse('A "variants" mező tömb kell legyen', 400)
  }

  const rawList = (body as { variants: unknown[] }).variants
  const items: VariantPayload[] = []
  for (const raw of rawList) {
    const parsed = parseVariant(raw)
    if (parsed instanceof Error) return errorResponse(parsed.message, 400)
    items.push(parsed)
  }

  const supabase = await createClient()

  const productExists = await ensureProductExists(supabase, productId)
  if (productExists instanceof NextResponse) return productExists

  const updated: ProductVariant[] = []
  const inserted: ProductVariant[] = []

  // Sequential to keep error handling simple — variant counts are small (sizes/colors).
  for (const item of items) {
    if (item.id) {
      const update: TablesUpdate<'product_variants'> = {
        stock: item.stock,
      }
      if (item.size !== undefined) update.size = item.size
      if (item.color !== undefined) update.color = item.color

      const { data, error } = await supabase
        .from('product_variants')
        .update(update as never)
        .eq('id', item.id)
        .eq('product_id', productId)
        .select('*')
        .single()

      if (error || !data) {
        return errorResponse(
          `Variáns frissítése sikertelen (${item.id}): ${error?.message ?? 'nem található'}`,
          error ? 500 : 404
        )
      }
      updated.push(data as ProductVariant)
    } else {
      const insert: TablesInsert<'product_variants'> = {
        product_id: productId,
        size: item.size ?? null,
        color: item.color ?? null,
        stock: item.stock,
      }
      const { data, error } = await supabase
        .from('product_variants')
        .insert(insert as never)
        .select('*')
        .single()

      if (error || !data) {
        return errorResponse(
          `Variáns létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
          500
        )
      }
      inserted.push(data as ProductVariant)
    }
  }

  return successResponse({ updated, inserted })
}

// ---------------------------------------------------------------------------
// DELETE — remove a single variant via ?variantId=...
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id: productId } = await context.params
  if (!productId) return errorResponse('Hiányzó termék azonosító', 400)

  const { searchParams } = new URL(request.url)
  const variantId = searchParams.get('variantId')
  if (!variantId) return errorResponse('Hiányzó variantId paraméter', 400)

  const supabase = await createClient()

  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', variantId)
    .eq('product_id', productId)

  if (error) {
    if (error.code === '23503') {
      return errorResponse(
        'A variáns nem törölhető, mert szerepel rendelésekben',
        409
      )
    }
    return errorResponse(`Variáns törlése sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ success: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureProductExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string
): Promise<true | NextResponse> {
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle()
  if (error) {
    return errorResponse(`Termék lekérése sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('A termék nem található', 404)
  }
  return true
}

async function readJson(
  request: NextRequest
): Promise<unknown | NextResponse> {
  try {
    return await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }
}

function parseVariant(raw: unknown): VariantPayload | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen variáns elem')
  }
  const candidate = raw as Record<string, unknown>

  const stockRaw = candidate.stock
  const stock =
    typeof stockRaw === 'number'
      ? stockRaw
      : typeof stockRaw === 'string'
        ? Number.parseInt(stockRaw, 10)
        : NaN
  if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
    return new Error('Érvénytelen készlet érték')
  }

  const id = typeof candidate.id === 'string' ? candidate.id : undefined

  let size: string | null | undefined = undefined
  if (candidate.size === null) size = null
  else if (typeof candidate.size === 'string') {
    const trimmed = candidate.size.trim()
    size = trimmed.length > 0 ? trimmed : null
  }

  let color: string | null | undefined = undefined
  if (candidate.color === null) color = null
  else if (typeof candidate.color === 'string') {
    const trimmed = candidate.color.trim()
    color = trimmed.length > 0 ? trimmed : null
  }

  return { id, size, color, stock }
}
