import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'

/**
 * GET /api/admin/coupons/[id]/stats
 *
 * Admin-only. Returns redemption + usage counters for a single coupon.
 *
 * Semantics (mapped onto the redeemed_coupons schema):
 *   - total_issued    = number of redeemed_coupons rows for this coupon
 *                       (every row is a code that was issued to a user)
 *   - total_redeemed  = rows with is_used = true (the user actually consumed
 *                       the code at checkout / ticket purchase)
 *   - total_unused    = rows with is_used = false (codes still claimable)
 *   - usage_rate      = (total_redeemed / total_issued) * 100, two decimals.
 *                       Returns 0 when total_issued = 0.
 *
 * Errors:
 *   - 401 / 403 via requireAdminApi()
 *   - 404 if the coupon does not exist
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export type CouponStats = {
  total_issued: number
  total_redeemed: number
  total_unused: number
  usage_rate: number
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  // 404 guard — confirm the coupon exists before returning a zero-row stat.
  const { data: existing, error: fetchError } = await supabase
    .from('coupons')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Kupon lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('A kupon nem található', 404)
  }

  // Aggregate the redemption rows. We do two cheap counts rather than
  // pulling every row, and use the `head: true` + `count: 'exact'` form so
  // PostgREST returns just the numbers.
  const totalIssuedQuery = await supabase
    .from('redeemed_coupons')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', id)

  if (totalIssuedQuery.error) {
    return errorResponse(
      `Statisztika lekérése sikertelen: ${totalIssuedQuery.error.message}`,
      500
    )
  }

  const totalRedeemedQuery = await supabase
    .from('redeemed_coupons')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', id)
    .eq('is_used', true)

  if (totalRedeemedQuery.error) {
    return errorResponse(
      `Statisztika lekérése sikertelen: ${totalRedeemedQuery.error.message}`,
      500
    )
  }

  const total_issued = totalIssuedQuery.count ?? 0
  const total_redeemed = totalRedeemedQuery.count ?? 0
  const total_unused = Math.max(0, total_issued - total_redeemed)
  const usage_rate =
    total_issued === 0
      ? 0
      : Math.round((total_redeemed / total_issued) * 10_000) / 100

  const stats: CouponStats = {
    total_issued,
    total_redeemed,
    total_unused,
    usage_rate,
  }

  return successResponse(stats)
}
