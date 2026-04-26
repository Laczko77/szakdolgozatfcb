import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type {
  Coupon,
  DiscountType,
  TablesInsert,
} from '@/types/database'

/**
 * /api/admin/coupons
 *
 * GET  — admin only. Lists every coupon (active + inactive) joined with
 *        redemption stats from the `coupon_redeem_stats` view.
 *
 * POST — admin only. Creates a new coupon.
 *   Body (JSON): {
 *     name: string,
 *     description?: string,
 *     discount_type: 'percentage' | 'fixed' | 'free_shipping',
 *     discount_value: number,   // % for percentage, currency for fixed, ignored for free_shipping
 *     point_cost: number,       // points required to redeem
 *     is_active?: boolean       // defaults to true
 *   }
 */

const VALID_DISCOUNT_TYPES: DiscountType[] = [
  'percentage',
  'fixed',
  'free_shipping',
]

// ---------------------------------------------------------------------------
// GET — list with stats (admin)
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const supabase = await createClient()

  const [couponsRes, statsRes] = await Promise.all([
    supabase.from('coupons').select('*').order('point_cost', { ascending: true }),
    supabase.from('coupon_redeem_stats' as never).select('*'),
  ])

  if (couponsRes.error) {
    return errorResponse(
      `Kuponok lekérése sikertelen: ${couponsRes.error.message}`,
      500
    )
  }
  if (statsRes.error) {
    return errorResponse(
      `Kupon statisztikák lekérése sikertelen: ${statsRes.error.message}`,
      500
    )
  }

  type StatsRow = {
    coupon_id: string
    redeemed_count: number
    used_count: number
  }
  const statsByCoupon = new Map<string, Omit<StatsRow, 'coupon_id'>>()
  for (const row of (statsRes.data ?? []) as unknown as StatsRow[]) {
    statsByCoupon.set(row.coupon_id, {
      redeemed_count: row.redeemed_count,
      used_count: row.used_count,
    })
  }

  const coupons = ((couponsRes.data ?? []) as Coupon[]).map((c) => ({
    ...c,
    stats: statsByCoupon.get(c.id) ?? { redeemed_count: 0, used_count: 0 },
  }))

  return NextResponse.json({ coupons })
}

// ---------------------------------------------------------------------------
// POST — create (admin)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  const parsed = parseCreatePayload(body)
  if (parsed instanceof Error) {
    return errorResponse(parsed.message, 400)
  }

  const supabase = await createClient()

  const insert: TablesInsert<'coupons'> = {
    name: parsed.name,
    description: parsed.description,
    discount_type: parsed.discount_type,
    discount_value: parsed.discount_value,
    point_cost: parsed.point_cost,
    is_active: parsed.is_active,
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Kupon létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Coupon, 201)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CreatePayload = {
  name: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  point_cost: number
  is_active: boolean
}

function parseCreatePayload(raw: unknown): CreatePayload | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen kérés tartalom')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    return new Error('A "name" mező kötelező')
  }

  let description: string | null = null
  if (obj.description !== undefined && obj.description !== null) {
    if (typeof obj.description !== 'string') {
      return new Error('A "description" mező érvénytelen')
    }
    description = obj.description.trim().length > 0 ? obj.description.trim() : null
  }

  if (typeof obj.discount_type !== 'string' ||
      !VALID_DISCOUNT_TYPES.includes(obj.discount_type as DiscountType)) {
    return new Error(
      `A "discount_type" mező értéke a következők egyike kell legyen: ${VALID_DISCOUNT_TYPES.join(', ')}`
    )
  }
  const discount_type = obj.discount_type as DiscountType

  if (typeof obj.discount_value !== 'number' ||
      Number.isNaN(obj.discount_value) ||
      obj.discount_value < 0) {
    return new Error('A "discount_value" mezőnek nemnegatív szám kell lennie')
  }
  if (discount_type === 'percentage' && obj.discount_value > 100) {
    return new Error('Százalékos kedvezmény értéke nem lehet 100 felett')
  }

  if (typeof obj.point_cost !== 'number' ||
      !Number.isInteger(obj.point_cost) ||
      obj.point_cost < 0) {
    return new Error('A "point_cost" mezőnek nemnegatív egész számnak kell lennie')
  }

  let is_active = true
  if (obj.is_active !== undefined) {
    if (typeof obj.is_active !== 'boolean') {
      return new Error('Az "is_active" mező érvénytelen')
    }
    is_active = obj.is_active
  }

  return {
    name: obj.name.trim(),
    description,
    discount_type,
    discount_value: obj.discount_value,
    point_cost: obj.point_cost,
    is_active,
  }
}
