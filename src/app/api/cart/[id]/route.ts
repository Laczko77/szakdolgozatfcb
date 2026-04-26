import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type { CartItem } from '@/types/database'

/**
 * /api/cart/[id]
 *
 * PUT    — authenticated, update quantity for a cart line. Validates against
 *          the variant's current stock.
 * DELETE — authenticated, remove a cart line.
 *
 * Both operations enforce ownership server-side: the row must belong to the
 * caller. We rely on `eq('user_id', user.id)` rather than RLS alone to keep
 * the contract explicit.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// PUT — change quantity
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

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

  const quantityRaw = candidate.quantity
  const quantity =
    typeof quantityRaw === 'number'
      ? quantityRaw
      : typeof quantityRaw === 'string'
        ? Number.parseInt(quantityRaw, 10)
        : NaN
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return errorResponse('A mennyiség pozitív egész szám kell legyen', 400)
  }

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('cart_items')
    .select('id, variant_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Kosár tétel lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A kosár tétel nem található', 404)
  }
  const existing = existingRaw as Pick<CartItem, 'id' | 'variant_id'>

  const { data: variantRaw, error: variantError } = await supabase
    .from('product_variants')
    .select('stock')
    .eq('id', existing.variant_id)
    .maybeSingle()
  if (variantError) {
    return errorResponse(`Variáns lekérése sikertelen: ${variantError.message}`, 500)
  }
  if (!variantRaw) {
    return errorResponse('A variáns nem található', 404)
  }
  const variant = variantRaw as { stock: number }
  if (quantity > variant.stock) {
    return errorResponse(
      `Nincs elegendő készlet (elérhető: ${variant.stock})`,
      409
    )
  }

  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity } as never)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Kosár frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as CartItem)
}

// ---------------------------------------------------------------------------
// DELETE — remove a line
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('cart_items')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Kosár tétel lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('A kosár tétel nem található', 404)
  }

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return errorResponse(`Kosár tétel törlése sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ success: true })
}
