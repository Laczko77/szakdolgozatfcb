import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Conversation, Message } from '@/types/database'

/**
 * /api/conversations/[id]/messages
 *
 * GET  — üzenet history kronológikus rendben (oldest first), kurzor-lapozással:
 *        ?before=<ISO timestamp>&limit=50  — a `before` timestampnél RÉGEBBI
 *        üzenetek (descending fetch + reverse a kimeneten).
 *
 * POST — üzenet küldés. Body: { content }. Validáció: 1..2000 karakter.
 *        A conversation last_message_at mezőjét frissítjük (az UPDATE-et az
 *        RLS conversations_update_participant policy engedi).
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const CONTENT_MIN = 1
const CONTENT_MAX = 2000

export async function GET(request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: conversationId } = await context.params
  if (!conversationId || !UUID_RE.test(conversationId)) {
    return errorResponse('Érvénytelen beszélgetés azonosító', 400)
  }

  const supabase = await createClient()

  // Részvevő ellenőrzés (RLS amúgy is védi, de értelmes 404 kell).
  const conversation = await loadParticipantConversation(supabase, conversationId, user.id)
  if (conversation instanceof NextResponse) return conversation

  const { searchParams } = new URL(request.url)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const beforeRaw = searchParams.get('before')

  let beforeIso: string | null = null
  if (beforeRaw) {
    const parsed = new Date(beforeRaw)
    if (Number.isNaN(parsed.getTime())) {
      return errorResponse('Érvénytelen "before" timestamp', 400)
    }
    beforeIso = parsed.toISOString()
  }

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (beforeIso) {
    query = query.lt('created_at', beforeIso)
  }

  const { data, error } = await query
  if (error) {
    return errorResponse(`Üzenetek lekérése sikertelen: ${error.message}`, 500)
  }

  const messages = ((data ?? []) as Message[]).reverse() // oldest → newest

  return NextResponse.json({
    messages,
    hasMore: (data ?? []).length === limit,
  })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: conversationId } = await context.params
  if (!conversationId || !UUID_RE.test(conversationId)) {
    return errorResponse('Érvénytelen beszélgetés azonosító', 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON body', 400)
  }

  const contentRaw =
    body && typeof body === 'object' && 'content' in body
      ? String((body as { content?: unknown }).content ?? '')
      : ''
  const content = contentRaw.trim()

  if (content.length < CONTENT_MIN || content.length > CONTENT_MAX) {
    return errorResponse(
      `Az üzenet hossza ${CONTENT_MIN} és ${CONTENT_MAX} karakter között kell legyen`,
      400
    )
  }

  const supabase = await createClient()

  // Részvevő ellenőrzés.
  const conversation = await loadParticipantConversation(supabase, conversationId, user.id)
  if (conversation instanceof NextResponse) return conversation

  // Iter22: defense-in-depth — küldéskor is meg kell lennie a kölcsönös
  // (accepted) követésnek. Ha bármelyik fél időközben kikövette a másikat,
  // a beszélgetés "fagyott" állapotba kerül és új üzenet nem küldhető.
  const otherUserId =
    conversation.participant_a === user.id
      ? conversation.participant_b
      : conversation.participant_a

  const { data: mutualData, error: mutualErr } = await supabase.rpc('is_mutual_follow', {
    p_a: user.id,
    p_b: otherUserId,
  } as never)
  if (mutualErr) {
    return errorResponse(`Követési ellenőrzés sikertelen: ${mutualErr.message}`, 500)
  }
  if (mutualData !== true) {
    return errorResponse(
      'Üzenet küldéséhez kölcsönös elfogadott követés szükséges',
      403
    )
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    } as never)
    .select('*')
    .single()

  if (insertErr) {
    return errorResponse(`Üzenet küldése sikertelen: ${insertErr.message}`, 500)
  }

  // Best-effort last_message_at frissítés. Ha az UPDATE megbukik, az üzenet
  // attól még létrejött; csak a beszélgetés-rendezés lesz aktualizálatlan.
  await supabase
    .from('conversations')
    .update({ last_message_at: (inserted as Message).created_at } as never)
    .eq('id', conversationId)

  return NextResponse.json({ message: inserted as Message }, { status: 201 })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Visszaadja a conversation rowt, ha a hívó user résztvevő. Ha nem létezik
 * vagy nem résztvevő → 404 / 403 NextResponse. Az RLS amúgy is védi az
 * adatokat, de a kifejezett státuszkódok jobban segítik a frontendet.
 */
async function loadParticipantConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  userId: string
): Promise<Conversation | NextResponse> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle()

  if (error) {
    return errorResponse(`Beszélgetés lekérése sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('A beszélgetés nem található', 404)
  }
  const conv = data as Conversation
  if (conv.participant_a !== userId && conv.participant_b !== userId) {
    return errorResponse('Nincs hozzáférés ehhez a beszélgetéshez', 403)
  }
  return conv
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}
