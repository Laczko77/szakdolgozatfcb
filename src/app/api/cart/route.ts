import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import { computeSalePricing } from '@/lib/sale-pricing'
import type {
  CartItem,
  Product,
  ProductVariant,
  TablesInsert,
} from '@/types/database'

/**
 * /api/cart
 *
 * GET  — authenticated, return the current user's cart joined with variant +
 *        product info so the frontend can render line items without follow-up
 *        round-trips.
 * POST — authenticated, add a variant to the cart. Enforces:
 *          - variant exists
 *          - quantity > 0
 *          - quantity (existing + new) does not exceed variant stock
 *        UNIQUE (user_id, variant_id) at the DB level means we upsert on
 *        conflict by adding to the existing quantity.
 */

type CartLineItem = CartItem & {
  variant: ProductVariant & {
    product: Pick<
      Product,
      | 'id'
      | 'name'
      | 'price'
      | 'image_url'
      | 'category'
      | 'sale_price'
      | 'sale_starts_at'
      | 'sale_ends_at'
    >
  }
}

// ---------------------------------------------------------------------------
// GET — current user's cart
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cart_items')
    .select(
      `
      *,
      variant:product_variants (
        *,
        product:products (id, name, price, image_url, category, sale_price, sale_starts_at, sale_ends_at)
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(`Kosár lekérése sikertelen: ${error.message}`, 500)
  }

  const items = (data ?? []) as unknown as CartLineItem[]

  // Total uses the snapshot price stored when the item was added, so an
  // expired sale doesn't surprise the customer at checkout. Falls back to
  // the live product price for legacy rows where snapshot may be 0.
  const total = items.reduce((sum, item) => {
    const snapshot = item.unit_price_snapshot
    const fallback = item.variant?.product?.price ?? 0
    const price = snapshot > 0 ? snapshot : fallback
    return sum + item.quantity * price
  }, 0)

  return NextResponse.json({
    items,
    total: Number(total.toFixed(2)),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  })
}

// ---------------------------------------------------------------------------
// POST — add to cart
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés', 400)
  }
  const candidate = body as Record<string, unknown>

  const variantId =
    typeof candidate.variant_id === 'string' ? candidate.variant_id : null
  if (!variantId) return errorResponse('A "variant_id" mező kötelező', 400)

  const quantityRaw = candidate.quantity
  const quantity =
    typeof quantityRaw === 'number'
      ? quantityRaw
      : typeof quantityRaw === 'string'
        ? Number.parseInt(quantityRaw, 10)
        : 1
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return errorResponse('A mennyiség pozitív egész szám kell legyen', 400)
  }

  const supabase = await createClient()

  // Iter25: pull the variant + parent product fields needed to snapshot the
  // currently effective price into cart_items.unit_price_snapshot. The snapshot
  // protects the customer if the sale expires between add-to-cart and checkout.
  const { data: variantRaw, error: variantError } = await supabase
    .from('product_variants')
    .select(
      `
      id,
      stock,
      product:products (price, sale_price, sale_starts_at, sale_ends_at)
    `
    )
    .eq('id', variantId)
    .maybeSingle()

  if (variantError) {
    return errorResponse(`Variáns lekérése sikertelen: ${variantError.message}`, 500)
  }
  if (!variantRaw) {
    return errorResponse('A variáns nem található', 404)
  }
  const variant = variantRaw as unknown as {
    id: string
    stock: number
    product: {
      price: number
      sale_price: number | null
      sale_starts_at: string | null
      sale_ends_at: string | null
    } | null
  }
  if (!variant.product) {
    return errorResponse('A variáns terméke nem található', 404)
  }
  const snapshotPrice = computeSalePricing(variant.product).effective_price

  const { data: existing, error: existingError } = await supabase
    .from('cart_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('variant_id', variantId)
    .maybeSingle()

  if (existingError) {
    return errorResponse(`Kosár ellenőrzése sikertelen: ${existingError.message}`, 500)
  }

  const currentQty = existing ? (existing as CartItem).quantity : 0
  const nextQty = currentQty + quantity
  if (nextQty > variant.stock) {
    return errorResponse(
      `Nincs elegendő készlet (elérhető: ${variant.stock - currentQty})`,
      409
    )
  }

  if (existing) {
    // Re-adding a variant refreshes the snapshot to the *current* effective
    // price. Rationale: the customer just confirmed they want this item at
    // today's price; carrying an older snapshot forward would be surprising
    // (especially if the price went down).
    const { data: updated, error: updateError } = await supabase
      .from('cart_items')
      .update({
        quantity: nextQty,
        unit_price_snapshot: snapshotPrice,
      } as never)
      .eq('id', (existing as CartItem).id)
      .select('*')
      .single()
    if (updateError || !updated) {
      return errorResponse(
        `Kosár frissítése sikertelen: ${updateError?.message ?? 'ismeretlen hiba'}`,
        500
      )
    }
    return successResponse(updated as CartItem)
  }

  const insert: TablesInsert<'cart_items'> = {
    user_id: user.id,
    variant_id: variantId,
    quantity,
    unit_price_snapshot: snapshotPrice,
  }

  const { data, error } = await supabase
    .from('cart_items')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Kosárba helyezés sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as CartItem, 201)
}
