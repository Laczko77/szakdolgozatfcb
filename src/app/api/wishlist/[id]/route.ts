import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'

/**
 * /api/wishlist/[id]
 *
 * DELETE — authenticated, remove a wishlist entry. The `[id]` segment is the
 * wishlist row id (NOT the product id). Ownership is enforced by
 * `eq('user_id', user.id)`.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('wishlist')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(
      `Kívánságlista tétel lekérése sikertelen: ${fetchError.message}`,
      500
    )
  }
  if (!existing) {
    return errorResponse('A kívánságlista tétel nem található', 404)
  }

  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return errorResponse(`Eltávolítás sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ success: true })
}
