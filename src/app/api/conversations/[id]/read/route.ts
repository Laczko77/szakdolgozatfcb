import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Conversation } from '@/types/database'

/**
 * /api/conversations/[id]/read
 *
 * PUT — bejelöli az összes olyan üzenetet OLVASOTT-ként a beszélgetésben,
 *       amit nem a hívó user küldött (vagyis a fogadó oldal).
 *       RLS: messages_update_recipient_marks_read engedi az UPDATE-et csak
 *       ott, ahol sender_id <> auth.uid().
 *
 * Visszaad: { updated: <darabszám> }
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PUT(_request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: conversationId } = await context.params
  if (!conversationId || !UUID_RE.test(conversationId)) {
    return errorResponse('Érvénytelen beszélgetés azonosító', 400)
  }

  const supabase = await createClient()

  // Részvevő ellenőrzés (404 / 403 a barátságos hibaüzenetekért).
  const { data: convData, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr) {
    return errorResponse(`Beszélgetés lekérése sikertelen: ${convErr.message}`, 500)
  }
  if (!convData) {
    return errorResponse('A beszélgetés nem található', 404)
  }
  const conv = convData as Conversation
  if (conv.participant_a !== user.id && conv.participant_b !== user.id) {
    return errorResponse('Nincs hozzáférés ehhez a beszélgetéshez', 403)
  }

  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: nowIso } as never)
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null)
    .select('id')

  if (error) {
    return errorResponse(`Üzenetek megjelölése sikertelen: ${error.message}`, 500)
  }

  return NextResponse.json({ updated: (data ?? []).length })
}
