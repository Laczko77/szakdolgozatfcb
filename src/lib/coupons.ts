import { createServiceRoleClient } from '@/lib/supabase/server'
import type { DiscountType, RedeemedCoupon } from '@/types/database'

/**
 * Coupon subsystem helpers.
 *
 * The DB-side logic (locking, point-charge, code generation, marking
 * is_used) lives in migration 010_iter10_coupons.sql. This module is a
 * thin TypeScript wrapper that exposes those RPCs to API route handlers,
 * plus a helper for computing the discounted total at checkout.
 *
 * Why RPCs and not application-level SQL:
 *   - redeem_coupon must atomically charge points + mint a unique code.
 *   - apply_coupon / consume must atomically validate + flip is_used so
 *     two concurrent checkouts can't both spend the same code.
 *   - Cleanly bypasses RLS without giving the API surface ad-hoc UPDATEs
 *     against redeemed_coupons.
 */

export const COUPONS_BUSINESS_RULE_SQLSTATE = 'P0001'

export type CouponApplyResult = {
  redeemed_id: string
  coupon_id: string
  discount_type: DiscountType
  discount_value: number
}

// ---------------------------------------------------------------------------
// redeemCoupon — point-shop redemption (POST /api/shop/coupons/[id]/redeem).
// ---------------------------------------------------------------------------

/**
 * Charge `point_cost` points and mint a fresh BARCA-XXXX-XXXX code linked
 * to {couponId} for {userId}. Returns the new redeemed_coupons row.
 *
 * Errors (Error.code = 'P0001') for business-rule violations:
 *   - coupon not found / inactive
 *   - insufficient points
 */
export async function redeemCoupon(
  userId: string,
  couponId: string
): Promise<RedeemedCoupon | Error> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc('redeem_coupon', {
    p_user_id: userId,
    p_coupon_id: couponId,
  } as never)

  if (error) {
    return wrapPgError(error)
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return new Error('A kupon beváltása váratlan választ adott')
  }

  // The RPC returns the redeemed_coupons row as JSONB.
  return data as unknown as RedeemedCoupon
}

// ---------------------------------------------------------------------------
// applyCouponToOrder — webshop checkout (POST /api/orders).
// ---------------------------------------------------------------------------

/**
 * Validates `code`, marks the redeemed_coupons row as used, and links
 * orders.coupon_id to it. The caller (the orders route) is responsible
 * for re-reading the order's total_price and re-saving it with the
 * discount applied (see `applyDiscount`).
 *
 * Errors (Error.code = 'P0001'):
 *   - code not found / not owned by user / already used
 *   - order not found / not owned by user
 */
export async function applyCouponToOrder(
  orderId: string,
  userId: string,
  code: string
): Promise<CouponApplyResult | Error> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc('apply_coupon_to_order', {
    p_order_id: orderId,
    p_user_id: userId,
    p_code: code,
  } as never)

  if (error) {
    return wrapPgError(error)
  }

  return parseApplyResult(data)
}

// ---------------------------------------------------------------------------
// consumeCoupon — generic checkout (ticket purchase).
// ---------------------------------------------------------------------------

/**
 * Validate `code` and flip is_used = true without linking it to any orders
 * row. Use for purchase flows that don't have an orders row to attach to
 * (e.g. tickets — the schema has no tickets.coupon_id column).
 *
 * Same error semantics as `applyCouponToOrder`.
 */
export async function consumeCoupon(
  userId: string,
  code: string
): Promise<CouponApplyResult | Error> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc('consume_coupon', {
    p_user_id: userId,
    p_code: code,
  } as never)

  if (error) {
    return wrapPgError(error)
  }

  return parseApplyResult(data)
}

// ---------------------------------------------------------------------------
// applyDiscount — pure helper for computing the discounted total.
// ---------------------------------------------------------------------------

/**
 * Compute the discounted total for a checkout.
 *
 * - 'percentage'    → subtract `discount_value` percent of `subtotal`
 *                     (clamped to 0..100).
 * - 'fixed'         → subtract `discount_value` flat (clamped at >= 0).
 * - 'free_shipping' → no-op against the subtotal; shipping is not modeled
 *                     in this project (demo checkout, no shipping costs).
 *
 * Returns { final, discount } both rounded to 2 decimals.
 */
export function applyDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): { final: number; discount: number } {
  let discount = 0

  if (discountType === 'percentage') {
    const pct = Math.min(Math.max(discountValue, 0), 100)
    discount = (subtotal * pct) / 100
  } else if (discountType === 'fixed') {
    discount = Math.max(discountValue, 0)
  } else {
    // free_shipping — no shipping costs in this project.
    discount = 0
  }

  // Never let the discount exceed the subtotal.
  if (discount > subtotal) discount = subtotal

  const final = subtotal - discount
  return {
    final: Number(final.toFixed(2)),
    discount: Number(discount.toFixed(2)),
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function wrapPgError(error: unknown): Error {
  const msg = (error as { message?: string }).message ?? 'Adatbázis hiba'
  const code = (error as { code?: string }).code
  const wrapped = new Error(msg) as Error & { code?: string }
  wrapped.code = code
  return wrapped
}

function parseApplyResult(data: unknown): CouponApplyResult | Error {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return new Error('A kupon alkalmazása váratlan választ adott')
  }
  const obj = data as Record<string, unknown>
  if (
    typeof obj.redeemed_id !== 'string' ||
    typeof obj.coupon_id !== 'string' ||
    typeof obj.discount_type !== 'string' ||
    typeof obj.discount_value !== 'number'
  ) {
    return new Error('A kupon alkalmazása váratlan választ adott')
  }
  return {
    redeemed_id: obj.redeemed_id,
    coupon_id: obj.coupon_id,
    discount_type: obj.discount_type as DiscountType,
    discount_value: obj.discount_value,
  }
}
