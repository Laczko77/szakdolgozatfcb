import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import {
  COUPONS_BUSINESS_RULE_SQLSTATE,
  applyDiscount,
  consumeCoupon,
} from '@/lib/coupons'
import type { MatchSector, Ticket } from '@/types/database'
import { parsePurchasePayload } from './_helpers'

/**
 * POST /api/tickets/purchase
 *
 * Authenticated. Buy 1..4 tickets for a single match in a single sector.
 *
 * Body (JSON): { match_id: string, sector_id: string, quantity: number }
 *
 * Validation + atomicity is delegated to the `purchase_tickets` RPC, which
 * runs inside a transaction with an advisory lock keyed on the sector id.
 * That RPC enforces:
 *   - 1 <= quantity <= 4
 *   - sector exists and belongs to a real match
 *   - sold_seats + quantity <= total_seats
 *   - existing tickets (this user, this match) + quantity <= 4
 *   - contiguous next-seat allocation
 *   - sold_seats counter bump
 *
 * The `match_id` body field is validated here against the sector to give a
 * clearer error than the RPC, but is not strictly needed by the RPC.
 */

const BUSINESS_RULE_SQLSTATE = 'P0001'

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

  const parsed = parsePurchasePayload(body)
  if (parsed instanceof Error) {
    return errorResponse(parsed.message, 400)
  }

  // Service-role: the RPC is SECURITY DEFINER but this also lets us read the
  // sector for the match-id sanity check without round-tripping RLS.
  const supabase = createServiceRoleClient()

  // Sanity-check that the sector belongs to the claimed match + grab price
  // for the (optional) coupon math we run after a successful purchase.
  const { data: sector, error: sectorError } = await supabase
    .from('match_sectors')
    .select('id, match_id, price')
    .eq('id', parsed.sector_id)
    .maybeSingle()

  if (sectorError) {
    return errorResponse(
      `Szektor lekérése sikertelen: ${sectorError.message}`,
      500
    )
  }
  if (!sector) {
    return errorResponse('A megadott szektor nem található', 404)
  }
  if ((sector as Pick<MatchSector, 'match_id'>).match_id !== parsed.match_id) {
    return errorResponse('A szektor nem ehhez a meccshez tartozik', 400)
  }
  const sectorPrice = Number((sector as Pick<MatchSector, 'price'>).price)

  // Call the RPC. The Database['public']['Functions'] type is declared in
  // src/types/database.ts; we cast at the SDK boundary to match the pattern
  // used elsewhere in this codebase for `.insert(... as never)`.
  const { data, error } = await supabase.rpc('purchase_tickets', {
    p_user_id: user.id,
    p_sector_id: parsed.sector_id,
    p_quantity: parsed.quantity,
  } as never)

  if (error) {
    // Map the explicit business-rule SQLSTATE to 409 Conflict.
    // Other Postgres errors are 500.
    const code = (error as { code?: string }).code
    if (code === BUSINESS_RULE_SQLSTATE) {
      return errorResponse(error.message, 409)
    }
    return errorResponse(
      `Jegyvásárlás sikertelen: ${error.message}`,
      500
    )
  }

  // RPC returns a JSONB array of inserted ticket rows.
  const tickets = (Array.isArray(data) ? data : []) as Ticket[]

  // Compute the un-discounted total. The schema has no tickets.coupon_id, so
  // the coupon is tracked on the redeemed_coupons row only (is_used = true).
  const subtotal = sectorPrice * parsed.quantity
  let finalTotal = Number(subtotal.toFixed(2))
  let appliedDiscount = 0
  let appliedCouponCode: string | null = null

  if (parsed.coupon_code) {
    const apply = await consumeCoupon(user.id, parsed.coupon_code)
    if (apply instanceof Error) {
      // Tickets are already minted at this point. Surface the coupon error
      // as a non-fatal warning so the caller still gets the tickets.
      const code = (apply as Error & { code?: string }).code
      const message =
        code === COUPONS_BUSINESS_RULE_SQLSTATE
          ? apply.message
          : `Kupon alkalmazása sikertelen: ${apply.message}`
      return successResponse(
        {
          tickets,
          subtotal: finalTotal,
          total: finalTotal,
          coupon: null,
          warning: message,
        },
        201
      )
    }

    const computed = applyDiscount(
      subtotal,
      apply.discount_type,
      apply.discount_value
    )
    finalTotal = computed.final
    appliedDiscount = computed.discount
    appliedCouponCode = parsed.coupon_code
  }

  return successResponse(
    {
      tickets,
      subtotal: Number(subtotal.toFixed(2)),
      total: finalTotal,
      coupon: appliedCouponCode
        ? { code: appliedCouponCode, discount: appliedDiscount }
        : null,
    },
    201
  )
}

