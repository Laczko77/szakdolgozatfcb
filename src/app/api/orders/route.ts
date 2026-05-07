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
import {
  COUPONS_BUSINESS_RULE_SQLSTATE,
  applyCouponToOrder,
  applyDiscount,
} from '@/lib/coupons'
import type {
  Order,
  OrderItem,
  ProductVariant,
} from '@/types/database'
import { parseOptionalCouponCode, parseShippingAddress } from './_helpers'

// SQLSTATE the checkout_order / purchase_tickets RPCs raise for business-rule
// violations (empty cart, insufficient stock, …). Mapped to HTTP 409.
const BUSINESS_RULE_SQLSTATE = 'P0001'

/**
 * /api/orders
 *
 * POST — authenticated, demo checkout. Delegates the cart -> order conversion
 *        to the `checkout_order` RPC, which atomically locks each variant
 *        row, validates stock, creates the order + order_items, decrements
 *        stock, and clears the cart. Coupon application happens AFTER the
 *        RPC (and is non-fatal): a bad code surfaces as a warning on the
 *        successful order response rather than rolling the whole thing back.
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

  const couponCode = parseOptionalCouponCode(body)
  if (couponCode instanceof Error) {
    return errorResponse(couponCode.message, 400)
  }

  // Service-role client: the checkout_order RPC is SECURITY DEFINER, but we
  // also need privileged reads for the post-checkout fetch and the optional
  // coupon path. The route itself is auth-guarded, so user.id is trustworthy.
  const supabase = createServiceRoleClient()

  // 1. Snapshot cart subtotal so we can pass total_price to the RPC. The RPC
  //    re-reads the cart under FOR UPDATE locks, so a stale subtotal here
  //    would only affect the persisted total — but the same lock ordering
  //    means the snapshot is what the RPC sees too. Coupon discount is
  //    applied separately after the order exists.
  const { data: cartRows, error: cartError } = await supabase
    .from('cart_items')
    .select(
      `
      quantity,
      variant:product_variants (
        product:products ( price )
      )
    `
    )
    .eq('user_id', user.id)

  if (cartError) {
    return errorResponse(`Kosár lekérése sikertelen: ${cartError.message}`, 500)
  }

  type CartRow = {
    quantity: number
    variant: {
      product: { price: number } | null
    } | null
  }
  const cart = (cartRows ?? []) as unknown as CartRow[]

  if (cart.length === 0) {
    return errorResponse('A kosár üres', 400)
  }

  const subtotal = cart.reduce((sum, item) => {
    const price = item.variant?.product?.price ?? 0
    return sum + price * item.quantity
  }, 0)
  const subtotalRounded = Number(subtotal.toFixed(2))

  // 2. Atomic checkout: stock validation, order + order_items insert, stock
  //    decrement, cart clear — all in one transaction inside the RPC.
  //    Concurrent checkouts that fight for the last unit are serialised by
  //    the per-variant FOR UPDATE locks the RPC takes.
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'checkout_order',
    {
      p_user_id: user.id,
      p_total_price: subtotalRounded,
      p_shipping_address: shippingAddress,
    } as never
  )

  if (rpcError) {
    const code = (rpcError as { code?: string }).code
    if (code === BUSINESS_RULE_SQLSTATE) {
      return errorResponse(rpcError.message, 409)
    }
    return errorResponse(
      `Rendelés létrehozása sikertelen: ${rpcError.message}`,
      500
    )
  }

  const orderId = (rpcResult as { order_id?: string } | null)?.order_id
  if (!orderId) {
    return errorResponse(
      'Rendelés létrehozása sikertelen: érvénytelen RPC válasz',
      500
    )
  }

  // 3. Apply coupon (optional). The order is already committed; on coupon
  //    failure we surface a non-fatal warning rather than rolling back, which
  //    matches the behaviour of /api/tickets/purchase.
  let finalTotal = subtotalRounded
  let appliedDiscount = 0
  let appliedCouponCode: string | null = null
  let couponWarning: string | null = null

  if (couponCode) {
    const apply = await applyCouponToOrder(orderId, user.id, couponCode)
    if (apply instanceof Error) {
      const code = (apply as Error & { code?: string }).code
      couponWarning =
        code === COUPONS_BUSINESS_RULE_SQLSTATE
          ? apply.message
          : `Kupon alkalmazása sikertelen: ${apply.message}`
    } else {
      const computed = applyDiscount(
        subtotal,
        apply.discount_type,
        apply.discount_value
      )
      finalTotal = computed.final
      appliedDiscount = computed.discount
      appliedCouponCode = couponCode

      const { error: totalError } = await supabase
        .from('orders')
        .update({ total_price: finalTotal } as never)
        .eq('id', orderId)

      if (totalError) {
        couponWarning = `Rendelés végösszegének frissítése sikertelen: ${totalError.message}`
      }
    }
  }

  // 4. Re-read the canonical order row so the response matches what's in DB.
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !orderRow) {
    return errorResponse(
      `Rendelés lekérése sikertelen: ${orderError?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  const responsePayload = {
    order: orderRow as Order,
    coupon: appliedCouponCode
      ? { code: appliedCouponCode, discount: appliedDiscount }
      : null,
    ...(couponWarning ? { warning: couponWarning } : {}),
  }

  return successResponse(responsePayload, 201)
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

