import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'

/**
 * DELETE /api/admin/coupons/[id]/hard
 *
 * Admin-only. Physically removes a coupon from the database, alongside
 * every redeemed_coupons row that references it (FK ON DELETE CASCADE,
 * configured in migration 019_iter23_supabase_warnings_fix.sql).
 *
 * NOTE: This is destructive and irreversible. The standard
 * DELETE /api/admin/coupons/[id] endpoint performs a SOFT delete
 * (is_active = false) and remains the recommended path for retiring a
 * coupon that has already been issued to users.
 *
 * Errors:
 *   - 401 / 403 via requireAdminApi()
 *   - 404 if the coupon does not exist
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  // 404 guard before issuing the destructive DELETE so the caller gets a
  // clear "not found" instead of a silent 0-rows-affected.
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

  // ON DELETE CASCADE on redeemed_coupons.coupon_id removes the dependent
  // codes in the same transaction.
  const { error: deleteError } = await supabase
    .from('coupons')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return errorResponse(
      `Kupon törlése sikertelen: ${deleteError.message}`,
      500
    )
  }

  return successResponse({ deleted: true })
}
