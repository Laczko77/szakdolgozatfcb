import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAdminApi } from '@/lib/api-utils'
import type { Order, OrderItem, ProductVariant, OrderStatus } from '@/types/database'

/**
 * /api/admin/orders
 *
 * GET — admin only, paginated list with optional status filter.
 *   - status (OrderStatus, optional)
 *   - page / limit (pagination)
 */

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const ORDER_STATUSES: OrderStatus[] = [
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

export async function GET(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const page = clampInt(searchParams.get('page'), DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const status = searchParams.get('status')

  if (status !== null && !ORDER_STATUSES.includes(status as OrderStatus)) {
    return errorResponse('Érvénytelen státusz', 400)
  }

  const supabase = await createClient()

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('orders')
    .select(
      `
      *,
      items:order_items (
        *,
        variant:product_variants (
          *,
          product:products (id, name, image_url)
        )
      ),
      profile:profiles!orders_user_id_fkey (id, email, username)
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    return errorResponse(`Rendelések lekérése sikertelen: ${error.message}`, 500)
  }

  type OrderWithItems = Order & {
    items: (OrderItem & { variant: ProductVariant | null })[]
    profile: { id: string; email: string; username: string | null } | null
  }
  const total = count ?? 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return NextResponse.json({
    orders: (data ?? []) as unknown as OrderWithItems[],
    total,
    page,
    totalPages,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}
