import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAdminApi, successResponse } from '@/lib/api-utils'

/**
 * GET /api/admin/analytics/overview
 *
 * Admin-only. High-level KPI snapshot for the admin dashboard.
 *
 * Returns:
 *   - total_users        : number of profiles rows
 *   - total_orders       : non-cancelled orders
 *   - total_revenue      : SUM(orders.total_price) over non-cancelled orders
 *   - active_polls       : polls.is_active = TRUE
 *   - total_page_views   : page_views row count
 *   - total_consents     : cookie_consents row count
 *
 * All counts use Supabase's `head + count: 'exact'` to avoid pulling row data.
 * Revenue is a single SUM aggregate executed via .select() on a tiny payload.
 */

export async function GET() {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const supabase = await createClient()

  const [
    usersRes,
    ordersRes,
    revenueRes,
    pollsRes,
    pageViewsRes,
    consentsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'cancelled'),
    supabase
      .from('orders')
      .select('total_price')
      .neq('status', 'cancelled'),
    supabase
      .from('polls')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('cookie_consents')
      .select('id', { count: 'exact', head: true }),
  ])

  for (const res of [usersRes, ordersRes, revenueRes, pollsRes, pageViewsRes, consentsRes]) {
    if (res.error) {
      return errorResponse(
        `Áttekintő statisztika lekérése sikertelen: ${res.error.message}`,
        500
      )
    }
  }

  const totalRevenue = (
    (revenueRes.data ?? []) as { total_price: number }[]
  ).reduce((acc, r) => acc + Number(r.total_price ?? 0), 0)

  return successResponse({
    total_users: usersRes.count ?? 0,
    total_orders: ordersRes.count ?? 0,
    total_revenue: totalRevenue,
    active_polls: pollsRes.count ?? 0,
    total_page_views: pageViewsRes.count ?? 0,
    total_consents: consentsRes.count ?? 0,
  })
}
