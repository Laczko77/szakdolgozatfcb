import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
} from '@/lib/api-utils'

/**
 * /api/admin/comments/[id]
 *
 * DELETE — admin only, removes ANY comment regardless of author.
 *          Reactions targeting the comment are cleaned up first.
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
    .from('comments')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Komment lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existing) {
    return errorResponse('A komment nem található', 404)
  }

  // Polymorphic reactions — no FK cascade.
  await supabase
    .from('reactions')
    .delete()
    .eq('target_type', 'comment')
    .eq('target_id', id)

  const { error: deleteError } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return errorResponse(`Komment törlése sikertelen: ${deleteError.message}`, 500)
  }

  return NextResponse.json({ success: true })
}
