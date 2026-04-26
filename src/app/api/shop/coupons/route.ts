import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Coupon } from '@/types/database'

/**
 * GET /api/shop/coupons
 *
 * Public. Lists every coupon currently available for redemption
 * (is_active = true). RLS already constrains anonymous reads to
 * active coupons, but we filter explicitly so admins also see the
 * user-facing slice via this endpoint.
 *
 * Sorted by point_cost ascending so the cheapest options appear first.
 */
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('is_active', true)
    .order('point_cost', { ascending: true })

  if (error) {
    return errorResponse(`Kuponok lekérése sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ coupons: (data ?? []) as Coupon[] })
}
