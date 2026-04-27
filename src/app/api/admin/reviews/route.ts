import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAdminApi } from '@/lib/api-utils'
import type { Review } from '@/types/database'

/**
 * /api/admin/reviews
 *
 * GET — admin only, paginated list of ALL reviews (visible AND hidden).
 *   - page / limit  (pagination)
 *   - visibility    (optional: 'visible' | 'hidden')
 *
 * Joins the product (id, name, image_url) and the author (id, email,
 * username) so the moderation table can render rich rows without a
 * second round-trip.
 */

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const page = clampInt(searchParams.get('page'), DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const visibility = searchParams.get('visibility')

  if (visibility !== null && visibility !== 'visible' && visibility !== 'hidden') {
    return errorResponse('Érvénytelen láthatóság', 400)
  }

  const supabase = await createClient()

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('reviews')
    .select(
      `
      *,
      product:products (id, name, image_url),
      profile:profiles!reviews_user_id_fkey (id, email, username)
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (visibility === 'visible') query = query.eq('is_visible', true)
  if (visibility === 'hidden') query = query.eq('is_visible', false)

  const { data, error, count } = await query

  if (error) {
    return errorResponse(`Értékelések lekérése sikertelen: ${error.message}`, 500)
  }

  type ReviewWithJoin = Review & {
    product: { id: string; name: string; image_url: string | null } | null
    profile: { id: string; email: string; username: string | null } | null
  }
  const total = count ?? 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return NextResponse.json({
    reviews: (data ?? []) as unknown as ReviewWithJoin[],
    total,
    page,
    totalPages,
  })
}

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
