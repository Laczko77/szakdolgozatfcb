import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type { Product, TablesInsert, Wishlist } from '@/types/database'

/**
 * /api/wishlist
 *
 * GET  — authenticated, list the caller's wishlist with joined product info.
 * POST — authenticated, add a product. The DB enforces UNIQUE (user_id,
 *        product_id); a duplicate POST returns 409.
 */

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('wishlist')
    .select(
      `
      *,
      product:products (id, name, description, price, image_url, category)
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(`Kívánságlista lekérése sikertelen: ${error.message}`, 500)
  }

  type WishlistRow = Wishlist & { product: Product | null }
  return NextResponse.json({
    items: (data ?? []) as unknown as WishlistRow[],
  })
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

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

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés', 400)
  }
  const candidate = body as Record<string, unknown>
  const productId =
    typeof candidate.product_id === 'string' ? candidate.product_id : null
  if (!productId) return errorResponse('A "product_id" mező kötelező', 400)

  const supabase = await createClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle()
  if (productError) {
    return errorResponse(`Termék lekérése sikertelen: ${productError.message}`, 500)
  }
  if (!product) {
    return errorResponse('A termék nem található', 404)
  }

  const insert: TablesInsert<'wishlist'> = {
    user_id: user.id,
    product_id: productId,
  }

  const { data, error } = await supabase
    .from('wishlist')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return errorResponse('A termék már a kívánságlistádon szerepel', 409)
    }
    return errorResponse(
      `Kívánságlistához adás sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Wishlist, 201)
}
