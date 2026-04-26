import { NextResponse, type NextRequest } from 'next/server'
import {
  createClient,
  createServiceRoleClient,
} from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type {
  Order,
  OrderItem,
  ProductVariant,
} from '@/types/database'

/**
 * /api/orders/[id]
 *
 * GET    — authenticated, returns the caller's order with items.
 * DELETE — authenticated, cancels the order. Allowed only while status is
 *          NOT 'shipped' and NOT 'delivered'. Restores stock for each line.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// GET — order detail
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user, profile } = guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select(
      `
      *,
      items:order_items (
        *,
        variant:product_variants (
          *,
          product:products (id, name, image_url, category)
        )
      )
    `
    )
    .eq('id', id)

  // Non-admins only see their own orders.
  if (profile.role !== 'admin') {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return errorResponse(`Rendelés lekérése sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('A rendelés nem található', 404)
  }

  type OrderWithItems = Order & {
    items: (OrderItem & { variant: ProductVariant | null })[]
  }
  return NextResponse.json(data as unknown as OrderWithItems)
}

// ---------------------------------------------------------------------------
// DELETE — cancel order
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = createServiceRoleClient()

  const { data: orderRaw, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Rendelés lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!orderRaw) {
    return errorResponse('A rendelés nem található', 404)
  }
  const order = orderRaw as Order

  if (order.status === 'shipped' || order.status === 'delivered') {
    return errorResponse(
      'A rendelés már kiszállítás alatt van vagy kézbesítve lett, nem mondható le',
      409
    )
  }
  if (order.status === 'cancelled') {
    return errorResponse('A rendelés már le van mondva', 409)
  }

  // Load items so we can restore stock.
  const { data: itemsRaw, error: itemsError } = await supabase
    .from('order_items')
    .select('id, variant_id, quantity')
    .eq('order_id', id)

  if (itemsError) {
    return errorResponse(`Rendelés tételek lekérése sikertelen: ${itemsError.message}`, 500)
  }

  const items = (itemsRaw ?? []) as Pick<OrderItem, 'id' | 'variant_id' | 'quantity'>[]

  // Mark cancelled first — that way even if stock restoration partially fails,
  // the user does not see the order as still active.
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' } as never)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return errorResponse(
      `Rendelés lemondása sikertelen: ${updateError?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  // Restore stock per item. Best-effort: log via response if any line fails,
  // but don't reverse the cancellation.
  const failures: string[] = []
  for (const item of items) {
    const { data: variantRaw } = await supabase
      .from('product_variants')
      .select('stock')
      .eq('id', item.variant_id)
      .maybeSingle()
    if (!variantRaw) {
      failures.push(item.variant_id)
      continue
    }
    const stock = (variantRaw as Pick<ProductVariant, 'stock'>).stock
    const { error: stockError } = await supabase
      .from('product_variants')
      .update({ stock: stock + item.quantity } as never)
      .eq('id', item.variant_id)
    if (stockError) failures.push(item.variant_id)
  }

  return successResponse({
    order: updated as Order,
    stockRestoreFailures: failures,
  })
}
