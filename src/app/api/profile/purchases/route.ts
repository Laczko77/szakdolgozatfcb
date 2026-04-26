import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type {
  Match,
  MatchSector,
  Order,
  OrderItem,
  ProductVariant,
  Ticket,
} from '@/types/database'

/**
 * GET /api/profile/purchases
 *
 * Authenticated. Returns a unified, time-ordered timeline of the caller's
 * purchases — both webshop orders and match tickets — so the profile UI can
 * render a single "Vásárlási előzmények" stream.
 *
 * The response keeps the original objects intact and adds a `type`
 * discriminator plus a normalized `timestamp` field, which is the sort key:
 *   - orders: created_at
 *   - tickets: purchased_at
 *
 * Both lists are also returned separately for clients that prefer to render
 * them in two columns.
 */

type OrderWithItems = Order & {
  items: (OrderItem & {
    variant:
      | (ProductVariant & {
          product: { id: string; name: string; image_url: string | null } | null
        })
      | null
  })[]
}

type TicketWithRelations = Ticket & {
  sector: (MatchSector & { match: Match | null }) | null
}

type TimelineEntry =
  | { type: 'order'; timestamp: string; order: OrderWithItems }
  | { type: 'ticket'; timestamp: string; ticket: TicketWithRelations }

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  // Fire both queries in parallel — they are independent and both bound by
  // RLS to the caller's rows.
  const [ordersRes, ticketsRes] = await Promise.all([
    supabase
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
        )
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tickets')
      .select(
        `
        *,
        sector:match_sectors (
          *,
          match:matches (*)
        )
      `
      )
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false }),
  ])

  if (ordersRes.error) {
    return errorResponse(
      `Rendelések lekérése sikertelen: ${ordersRes.error.message}`,
      500
    )
  }
  if (ticketsRes.error) {
    return errorResponse(
      `Jegyek lekérése sikertelen: ${ticketsRes.error.message}`,
      500
    )
  }

  const orders = (ordersRes.data ?? []) as unknown as OrderWithItems[]
  const tickets = (ticketsRes.data ?? []) as unknown as TicketWithRelations[]

  const timeline: TimelineEntry[] = [
    ...orders.map<TimelineEntry>((order) => ({
      type: 'order',
      timestamp: order.created_at,
      order,
    })),
    ...tickets.map<TimelineEntry>((ticket) => ({
      type: 'ticket',
      timestamp: ticket.purchased_at,
      ticket,
    })),
  ]

  // Newest first. localeCompare on ISO-8601 strings is correct ordering.
  timeline.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return NextResponse.json({
    timeline,
    orders,
    tickets,
  })
}
