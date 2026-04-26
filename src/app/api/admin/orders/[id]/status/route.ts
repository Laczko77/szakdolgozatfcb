import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type { Order, OrderStatus } from '@/types/database'

/**
 * /api/admin/orders/[id]/status
 *
 * PUT — admin only, advance the order's shipping status. Allowed transitions:
 *   processing -> shipped
 *   shipped    -> delivered
 *   processing -> cancelled  (admin-side cancellation; user cancellation goes
 *                             through DELETE /api/orders/[id])
 *
 * Body (JSON): { status: OrderStatus }
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

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
    return errorResponse('Érvénytelen kérés', 400)
  }
  const candidate = body as Record<string, unknown>
  const nextStatus = candidate.status

  if (
    nextStatus !== 'processing' &&
    nextStatus !== 'shipped' &&
    nextStatus !== 'delivered' &&
    nextStatus !== 'cancelled'
  ) {
    return errorResponse('Érvénytelen státusz', 400)
  }

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Rendelés lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A rendelés nem található', 404)
  }
  const existing = existingRaw as Order

  const allowed = ALLOWED_TRANSITIONS[existing.status]
  if (!allowed.includes(nextStatus)) {
    return errorResponse(
      `A "${existing.status}" státuszból nem léphető a "${nextStatus}" állapotra`,
      409
    )
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: nextStatus } as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Státusz frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Order)
}
