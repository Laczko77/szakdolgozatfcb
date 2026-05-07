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
import { mapBusinessRuleError } from './_helpers'

/**
 * POST /api/shop/coupons/[id]/redeem
 *
 * Authenticated. Redeems a coupon: deducts `point_cost` from the user's
 * balance, mints a fresh `BARCA-XXXX-XXXX` code, and returns the new
 * redeemed_coupons row.
 *
 * Atomicity + uniqueness are enforced inside the `redeem_coupon` RPC
 * (migration 010). Business-rule violations surface as Error.code 'P0001'
 * from the RPC and are mapped here to the appropriate 4xx status by
 * inspecting the message — 404 for missing coupons, 409 for already-used
 * codes, 400 for everything else (insufficient points, inactive coupons).
 */

const LOG_PREFIX = '[shop/coupons/redeem]'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó kupon azonosító', 400)
  if (!UUID_REGEX.test(id)) {
    return errorResponse('Érvénytelen kupon azonosító', 400)
  }

  let result: Awaited<ReturnType<typeof redeemCoupon>>
  try {
    result = await redeemCoupon(user.id, id)
  } catch (err) {
    // Unexpected exception path (network, runtime, etc). Log diagnostics so
    // the prod-test 500 has a paper trail in Vercel logs.
    console.error(
      `${LOG_PREFIX} unexpected exception userId=${user.id} couponId=${id}:`,
      err
    )
    return errorResponse(
      `Kupon beváltása sikertelen: ${err instanceof Error ? err.message : 'ismeretlen hiba'}`,
      500
    )
  }

  if (result instanceof Error) {
    const code = (result as Error & { code?: string }).code

    if (code === COUPONS_BUSINESS_RULE_SQLSTATE) {
      // Map the business-rule message to an appropriate 4xx status.
      const { status, message } = mapBusinessRuleError(result.message)
      return errorResponse(message, status)
    }

    // Non-P0001 Postgres errors (e.g. RPC missing, schema drift) — log and
    // surface as 500 with a clearer message instead of letting the generic
    // wrapper swallow the diagnostic.
    console.error(
      `${LOG_PREFIX} non-business-rule DB error userId=${user.id} couponId=${id} code=${code ?? 'unknown'}: ${result.message}`
    )
    return errorResponse(`Kupon beváltása sikertelen: ${result.message}`, 500)
  }

  return successResponse(result, 201)
}

