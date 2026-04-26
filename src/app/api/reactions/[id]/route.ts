import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
} from '@/lib/api-utils'
import type { Reaction } from '@/types/database'

/**
 * /api/reactions/[id]
 *
 * DELETE — authenticated, lets a user revoke THEIR OWN reaction.
 *          Defence-in-depth: the row is fetched and ownership-checked here in
 *          addition to RLS, so we can return a clean 403 vs. a 0-row 404.
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
    .from('reactions')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Reakció lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A reakció nem található', 404)
  }
  const existing = existingRaw as Pick<Reaction, 'id' | 'user_id'>

  if (existing.user_id !== user.id) {
    return errorResponse('Csak a saját reakciódat törölheted', 403)
  }

  const { error: deleteError } = await supabase
    .from('reactions')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return errorResponse(`Reakció törlése sikertelen: ${deleteError.message}`, 500)
  }

  return NextResponse.json({ success: true })
}
