import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type { Product, TablesUpdate } from '@/types/database'

/**
 * DELETE /api/admin/products/[id]/sale
 *
 * Admin-only. Clears the sale on a product by setting `sale_price`,
 * `sale_starts_at`, and `sale_ends_at` all to NULL. Idempotent — calling on
 * a product without an active sale still returns 200 with the unchanged row.
 *
 * Cart-snapshot prices that were captured during the sale window remain
 * untouched (the snapshot is the customer's contract, not the admin's).
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

  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Termék lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('A termék nem található', 404)
  }

  const update: TablesUpdate<'products'> = {
    sale_price: null,
    sale_starts_at: null,
    sale_ends_at: null,
  }

  const { data, error } = await supabase
    .from('products')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Akció törlése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Product)
}
