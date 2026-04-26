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
  ShippingAddress,
  TablesInsert,
} from '@/types/database'

/**
 * /api/orders
 *
 * POST — authenticated, demo checkout. Reads the user's cart, validates stock,
 *        creates an order + order_items, decrements stock per variant, then
 *        clears the cart. Best-effort transactional via the service-role
 *        client; on partial failure we attempt to roll back the order row to
 *        avoid orphans.
 *
 * GET  — authenticated, list the caller's orders (newest first).
 */

// ---------------------------------------------------------------------------
// POST — demo checkout
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

  const shippingAddress = parseShippingAddress(body)
  if (shippingAddress instanceof Error) {
    return errorResponse(shippingAddress.message, 400)
  }

  // Service-role client: needed to bypass RLS while we run the multi-step
  // checkout (insert order, decrement variant stock, clear cart). The route
  // itself is auth-guarded, so the user_id is trustworthy.
  const supabase = createServiceRoleClient()

  // 1. Load cart with variant prices
  const { data: cartRows, error: cartError } = await supabase
    .from('cart_items')
    .select(
      `
      id, quantity, variant_id,
      variant:product_variants (
        id, stock,
        product:products ( id, price )
      )
    `
    )
    .eq('user_id', user.id)

  if (cartError) {
    return errorResponse(`Kosár lekérése sikertelen: ${cartError.message}`, 500)
  }

  type CartRow = {
    id: string
    quantity: number
    variant_id: string
    variant: {
      id: string
      stock: number
      product: { id: string; price: number } | null
    } | null
  }
  const cart = (cartRows ?? []) as unknown as CartRow[]

  if (cart.length === 0) {
    return errorResponse('A kosár üres', 400)
  }

  // 2. Validate stock
  for (const item of cart) {
    if (!item.variant || !item.variant.product) {
      return errorResponse('A kosár hiányos terméket tartalmaz', 409)
    }
    if (item.quantity > item.variant.stock) {
      return errorResponse(
        `Nincs elegendő készlet (variáns: ${item.variant.id}, elérhető: ${item.variant.stock})`,
        409
      )
    }
  }

  // 3. Compute total
  const totalPrice = cart.reduce((sum, item) => {
    const price = item.variant?.product?.price ?? 0
    return sum + price * item.quantity
  }, 0)

  // 4. Create order
  const orderInsert: TablesInsert<'orders'> = {
    user_id: user.id,
    total_price: Number(totalPrice.toFixed(2)),
    shipping_address: shippingAddress,
    coupon_id: null,
  }

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .insert(orderInsert as never)
    .select('*')
    .single()

  if (orderError || !orderRow) {
    return errorResponse(
      `Rendelés létrehozása sikertelen: ${orderError?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }
  const order = orderRow as Order

  // 5. Insert order_items
  const orderItemInserts: TablesInsert<'order_items'>[] = cart.map((item) => ({
    order_id: order.id,
    variant_id: item.variant_id,
    quantity: item.quantity,
    unit_price: item.variant?.product?.price ?? 0,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemInserts as never)

  if (itemsError) {
    // Roll back the order row — order_items insertion failed.
    await supabase.from('orders').delete().eq('id', order.id)
    return errorResponse(
      `Rendelés tételek létrehozása sikertelen: ${itemsError.message}`,
      500
    )
  }

  // 6. Decrement stock per variant. Done sequentially so we can roll back
  //    cleanly on conflict (e.g. concurrent checkout taking the last unit).
  const stockUpdates: Array<{ variantId: string; previousStock: number }> = []
  for (const item of cart) {
    const variant = item.variant
    if (!variant) continue
    const newStock = variant.stock - item.quantity
    const { error: stockError } = await supabase
      .from('product_variants')
      .update({ stock: newStock } as never)
      .eq('id', variant.id)

    if (stockError) {
      // Roll back: restore previously decremented variants, delete order_items + order.
      for (const undo of stockUpdates) {
        await supabase
          .from('product_variants')
          .update({ stock: undo.previousStock } as never)
          .eq('id', undo.variantId)
      }
      await supabase.from('order_items').delete().eq('order_id', order.id)
      await supabase.from('orders').delete().eq('id', order.id)
      return errorResponse(
        `Készlet csökkentése sikertelen: ${stockError.message}`,
        500
      )
    }
    stockUpdates.push({ variantId: variant.id, previousStock: variant.stock })
  }

  // 7. Clear cart
  const { error: clearError } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', user.id)

  if (clearError) {
    // The order is already committed at this point; surface a warning but
    // don't roll back — leaving the cart populated is recoverable.
    return successResponse(
      {
        order,
        warning: `A kosár ürítése sikertelen: ${clearError.message}`,
      },
      201
    )
  }

  return successResponse({ order }, 201)
}

// ---------------------------------------------------------------------------
// GET — caller's orders
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      items:order_items (
        *,
        variant:product_variants (
          *,
          product:products (id, name, image_url)
        )
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(`Rendelések lekérése sikertelen: ${error.message}`, 500)
  }

  type OrderWithItems = Order & {
    items: (OrderItem & { variant: ProductVariant | null })[]
  }
  return NextResponse.json({
    orders: (data ?? []) as unknown as OrderWithItems[],
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseShippingAddress(raw: unknown): ShippingAddress | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen kérés tartalom')
  }
  const candidate = raw as Record<string, unknown>
  const addr = candidate.shipping_address
  if (typeof addr !== 'object' || addr === null) {
    return new Error('A "shipping_address" mező kötelező')
  }
  const a = addr as Record<string, unknown>
  const required: (keyof ShippingAddress)[] = [
    'full_name',
    'country',
    'city',
    'postal_code',
    'street',
  ]
  for (const key of required) {
    if (typeof a[key] !== 'string' || (a[key] as string).trim().length === 0) {
      return new Error(`Hiányzó "${key}" mező a szállítási címben`)
    }
  }
  const out: ShippingAddress = {
    full_name: (a.full_name as string).trim(),
    country: (a.country as string).trim(),
    city: (a.city as string).trim(),
    postal_code: (a.postal_code as string).trim(),
    street: (a.street as string).trim(),
  }
  if (typeof a.phone === 'string' && a.phone.trim().length > 0) {
    out.phone = a.phone.trim()
  }
  return out
}
