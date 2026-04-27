import { NextResponse, type NextRequest } from 'next/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import {
  COUPONS_BUSINESS_RULE_SQLSTATE,
  redeemCoupon,
} from '@/lib/coupons'

/**
 * POST /api/shop/coupons/[id]/redeem
 *
 * Authenticated. Redeems a coupon: deducts `point_cost` from the user's
 * balance, mints a fresh `BARCA-XXXX-XXXX` code, and returns the new
 * redeemed_coupons row.
 *
 * Atomicity + uniqueness are enforced inside the `redeem_coupon` RPC
 * (migration 010). Business-rule violations surface as Error.code
 * 'P0001' from the RPC and are mapped to 409 Conflict here.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó kupon azonosító', 400)

  let result: Awaited<ReturnType<typeof redeemCoupon>>
  try {
    result = await redeemCoupon(user.id, id)
  } catch (err) {
    return errorResponse(
      `Kupon beváltása sikertelen: ${err instanceof Error ? err.message : 'ismeretlen hiba'}`,
      500
    )
  }

  if (result instanceof Error) {
    const code = (result as Error & { code?: string }).code
    if (code === COUPONS_BUSINESS_RULE_SQLSTATE) {
      return errorResponse(result.message, 409)
    }
    return errorResponse(`Kupon beváltása sikertelen: ${result.message}`, 500)
  }

  return successResponse(result, 201)
}
