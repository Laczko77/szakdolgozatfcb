import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Coupon, RedeemedCoupon } from '@/types/database'

/**
 * GET /api/profile/coupons
 *
 * Authenticated. Returns the caller's redeemed coupons joined with the
 * coupon definition (name, discount_type, discount_value). RLS on
 * `redeemed_coupons` already restricts the SELECT to the authenticated
 * user, so we can read directly with the request-scoped client.
 *
 * Optional query string:
 *   - is_used=true | false → filter by used / unused
 *
 * Sorted newest first.
 */
export async function GET(request: Request) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const url = new URL(request.url)
  const isUsedRaw = url.searchParams.get('is_used')
  let isUsedFilter: boolean | null = null
  if (isUsedRaw === 'true') isUsedFilter = true
  else if (isUsedRaw === 'false') isUsedFilter = false

  const supabase = await createClient()

  let query = supabase
    .from('redeemed_coupons')
    .select(
      `
      *,
      coupon:coupons (
        id, name, description, discount_type, discount_value, point_cost, is_active
      )
    `
    )
    .eq('user_id', user.id)
    .order('redeemed_at', { ascending: false })

  if (isUsedFilter !== null) {
    query = query.eq('is_used', isUsedFilter)
  }

  const { data, error } = await query

  if (error) {
    return errorResponse(
      `Beváltott kuponok lekérése sikertelen: ${error.message}`,
      500
    )
  }

  type Row = RedeemedCoupon & { coupon: Coupon | null }
  return NextResponse.json({
    redeemed_coupons: (data ?? []) as unknown as Row[],
  })
}
