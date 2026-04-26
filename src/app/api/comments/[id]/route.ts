import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
} from '@/lib/api-utils'
import type { Comment } from '@/types/database'

/**
 * /api/comments/[id]
 *
 * DELETE — authenticated, lets a user delete THEIR OWN comment.
 *          Admins use /api/admin/comments/[id] instead (separate route =
 *          separate auth guard, so we can keep the policy explicit).
 *          Reactions targeting this comment are cleaned up first.
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

  const { data: existingRaw, error: fetchError } = await supabase
    .from('comments')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Komment lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A komment nem található', 404)
  }
  const existing = existingRaw as Pick<Comment, 'id' | 'user_id'>

  if (existing.user_id !== user.id) {
    return errorResponse('Csak a saját kommentedet törölheted', 403)
  }

  // reactions has a polymorphic target — no FK on comments. Wipe explicitly.
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
