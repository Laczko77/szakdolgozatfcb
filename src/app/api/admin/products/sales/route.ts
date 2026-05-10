import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
} from '@/lib/api-utils'
import { computeSalePricing, isSaleActive } from '@/lib/sale-pricing'
import type { Product } from '@/types/database'

/**
 * GET /api/admin/products/sales
 *
 * Admin-only. Lists products that currently have a sale configured —
 * either active right now, or upcoming, or with no end date. Excludes
 * sales that have already fully expired (sale_ends_at < now). Sorted so
 * active sales come first, then upcoming, then those without a window.
 *
 * Query params:
 *   - limit (1..100, default 50)
 */

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

type ProductSaleRow = Product & {
  effective_price: number
  is_on_sale: boolean
  status: 'active' | 'upcoming' | 'no_window'
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)

  const supabase = await createClient()

  const nowIso = new Date().toISOString()

  // We want every product with a non-null sale_price whose sale window has
  // not fully expired. The OR keeps "no end date" and "still upcoming" in
  // the result set; expired-only sales are filtered out server-side.
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .not('sale_price', 'is', null)
    .or(`sale_ends_at.is.null,sale_ends_at.gt.${nowIso}`)
    .order('sale_starts_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) {
    return errorResponse(`Akciók lekérése sikertelen: ${error.message}`, 500)
  }

  const now = new Date()
  const enriched: ProductSaleRow[] = ((data ?? []) as Product[]).map((p) => {
    const sale = computeSalePricing(p, now)
    const status: ProductSaleRow['status'] =
      isSaleActive(p, now)
        ? 'active'
        : p.sale_starts_at === null && p.sale_ends_at === null
          ? 'no_window'
          : 'upcoming'
    return {
      ...p,
      effective_price: sale.effective_price,
      is_on_sale: sale.is_on_sale,
      status,
    }
  })

  // Active first, then upcoming, then no_window. Within each bucket keep the
  // DB ordering (sale_starts_at asc, nulls first).
  const order: Record<ProductSaleRow['status'], number> = {
    active: 0,
    upcoming: 1,
    no_window: 2,
  }
  enriched.sort((a, b) => order[a.status] - order[b.status])

  return NextResponse.json({ sales: enriched })
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
