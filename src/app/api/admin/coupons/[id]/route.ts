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
  TablesUpdate,
} from '@/types/database'

/**
 * /api/admin/coupons/[id]
 *
 * PUT    — admin only. Partial update (name, description, discount_type,
 *          discount_value, point_cost, is_active).
 *
 * DELETE — admin only. Soft delete: flips is_active = false. We never hard-
 *          delete coupons because redeemed_coupons.coupon_id is FK-RESTRICTed,
 *          and existing redemption codes must remain usable / auditable.
 */

const VALID_DISCOUNT_TYPES: DiscountType[] = [
  'percentage',
  'fixed',
  'free_shipping',
]

type RouteContext = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// PUT — partial update (admin)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }
  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés tartalom', 400)
  }
  const obj = body as Record<string, unknown>

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('coupons')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Kupon lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('A kupon nem található', 404)
  }

  const update: TablesUpdate<'coupons'> = {}

  if (obj.name !== undefined) {
    if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
      return errorResponse('A "name" mező nem lehet üres', 400)
    }
    update.name = obj.name.trim()
  }

  if (obj.description !== undefined) {
    if (obj.description === null) {
      update.description = null
    } else if (typeof obj.description === 'string') {
      const trimmed = obj.description.trim()
      update.description = trimmed.length > 0 ? trimmed : null
    } else {
      return errorResponse('A "description" mező érvénytelen', 400)
    }
  }

  // Resolve the discount_type both for validation now and for consistent
  // bounds-checking on discount_value below.
  const nextType = (obj.discount_type ?? (existing as Coupon).discount_type) as DiscountType

  if (obj.discount_type !== undefined) {
    if (typeof obj.discount_type !== 'string' ||
        !VALID_DISCOUNT_TYPES.includes(obj.discount_type as DiscountType)) {
      return errorResponse(
        `A "discount_type" mező értéke a következők egyike kell legyen: ${VALID_DISCOUNT_TYPES.join(', ')}`,
        400
      )
    }
    update.discount_type = obj.discount_type as DiscountType
  }

  if (obj.discount_value !== undefined) {
    if (typeof obj.discount_value !== 'number' ||
        Number.isNaN(obj.discount_value) ||
        obj.discount_value < 0) {
      return errorResponse('A "discount_value" mezőnek nemnegatív szám kell lennie', 400)
    }
    if (nextType === 'percentage' && obj.discount_value > 100) {
      return errorResponse('Százalékos kedvezmény értéke nem lehet 100 felett', 400)
    }
    update.discount_value = obj.discount_value
  }

  if (obj.point_cost !== undefined) {
    if (typeof obj.point_cost !== 'number' ||
        !Number.isInteger(obj.point_cost) ||
        obj.point_cost < 0) {
      return errorResponse('A "point_cost" mezőnek nemnegatív egész számnak kell lennie', 400)
    }
    update.point_cost = obj.point_cost
  }

  if (obj.is_active !== undefined) {
    if (typeof obj.is_active !== 'boolean') {
      return errorResponse('Az "is_active" mező érvénytelen', 400)
    }
    update.is_active = obj.is_active
  }

  if (Object.keys(update).length === 0) {
    return successResponse(existing as Coupon)
  }

  const { data, error } = await supabase
    .from('coupons')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Kupon frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Coupon)
}

// ---------------------------------------------------------------------------
// DELETE — soft delete via is_active = false (admin)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

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

  const { data, error } = await supabase
    .from('coupons')
    .update({ is_active: false } as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Kupon deaktiválása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Coupon)
}
