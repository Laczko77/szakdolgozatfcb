import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type { Review } from '@/types/database'

/**
 * /api/admin/reviews/[id]
 *
 * PUT — admin only, toggle review visibility for moderation.
 * Body (JSON): { is_visible: boolean }
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

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
  if (typeof candidate.is_visible !== 'boolean') {
    return errorResponse('Az "is_visible" mező kötelező és boolean kell legyen', 400)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reviews')
    .update({ is_visible: candidate.is_visible } as never)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return errorResponse(`Értékelés moderáció sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('Az értékelés nem található', 404)
  }

  return successResponse(data as Review)
}
