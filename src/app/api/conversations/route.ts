import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireAuthApi } from '@/lib/api-utils'
import type { Conversation, Message, Profile } from '@/types/database'

/**
 * /api/conversations
 *
 * GET  — a hívó user összes beszélgetése, last_message_at szerint csökkenően,
 *        a másik résztvevő profil-mezőivel, az utolsó üzenettel és az
 *        olvasatlan üzenetek számával együtt.
 *
 * POST — új beszélgetés indítása vagy a meglévő visszaadása. Body: { targetUserId }.
 *        Ellenőrzések: nem saját maga, létező profil, KÖLCSÖNÖS KÖVETÉS.
 *        Canonical participant order: a < b lex. UUID szerint.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    return errorResponse(`Beszélgetések lekérése sikertelen: ${error.message}`, 500)
  }

  const conversations = (rows ?? []) as Conversation[]
  if (conversations.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  // Aggregátok: másik fél profilja + utolsó üzenet + olvasatlan szám.
  const otherIds = conversations.map((c) =>
    c.participant_a === user.id ? c.participant_b : c.participant_a
  )
  const conversationIds = conversations.map((c) => c.id)

  const [profilesById, lastMessageByConv, unreadByConv] = await Promise.all([
    fetchProfilesByIds(supabase, otherIds),
    fetchLastMessages(supabase, conversationIds),
    fetchUnreadCounts(supabase, conversationIds, user.id),
  ])

  const enriched = conversations.map((c) => {
    const otherId = c.participant_a === user.id ? c.participant_b : c.participant_a
    return {
      ...c,
      otherUser: profilesById.get(otherId) ?? null,
      lastMessage: lastMessageByConv.get(c.id) ?? null,
      unreadCount: unreadByConv.get(c.id) ?? 0,
    }
  })

  return NextResponse.json({ conversations: enriched })
}

export async function POST(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON body', 400)
  }

  const targetUserId =
    body && typeof body === 'object' && 'targetUserId' in body
      ? String((body as { targetUserId?: unknown }).targetUserId ?? '')
      : ''

  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return errorResponse('Érvénytelen targetUserId', 400)
  }
  if (targetUserId === user.id) {
    return errorResponse('Saját magaddal nem indíthatsz beszélgetést', 400)
  }

  const supabase = await createClient()

  // Target profil ellenőrzés.
  const { data: targetProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', targetUserId)
    .maybeSingle()
  if (profileErr) {
    return errorResponse(`Profil keresése sikertelen: ${profileErr.message}`, 500)
  }
  if (!targetProfile) {
    return errorResponse('A felhasználó nem található', 404)
  }

  // Mutual follow ellenőrzés (gyors fail-fast — az RLS WITH CHECK is védi a táblát,
  // de így explicit 403-at és értelmes üzenetet adunk vissza).
  const { data: mutualData, error: mutualErr } = await supabase.rpc('is_mutual_follow', {
    p_a: user.id,
    p_b: targetUserId,
  } as never)
  if (mutualErr) {
    return errorResponse(`Követési ellenőrzés sikertelen: ${mutualErr.message}`, 500)
  }
  if (mutualData !== true) {
    return errorResponse(
      'Beszélgetést csak kölcsönös követés esetén indíthatsz',
      403
    )
  }

  // Canonical participant order: a < b
  const [participantA, participantB] =
    user.id < targetUserId ? [user.id, targetUserId] : [targetUserId, user.id]

  // Idempotens: ha létezik, add vissza.
  const { data: existing, error: existingErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_a', participantA)
    .eq('participant_b', participantB)
    .maybeSingle()

  if (existingErr) {
    return errorResponse(`Beszélgetés keresése sikertelen: ${existingErr.message}`, 500)
  }
  if (existing) {
    return NextResponse.json({ conversation: existing as Conversation })
  }

  const { data: created, error: insertErr } = await supabase
    .from('conversations')
    .insert({
      participant_a: participantA,
      participant_b: participantB,
    } as never)
    .select('*')
    .single()

  if (insertErr) {
    // Ha párhuzamosan létrejött (UNIQUE constraint), olvassuk vissza.
    if (insertErr.code === '23505') {
      const { data: raced } = await supabase
        .from('conversations')
        .select('*')
        .eq('participant_a', participantA)
        .eq('participant_b', participantB)
        .single()
      if (raced) return NextResponse.json({ conversation: raced as Conversation })
    }
    return errorResponse(`Beszélgetés létrehozása sikertelen: ${insertErr.message}`, 500)
  }

  return NextResponse.json({ conversation: created as Conversation }, { status: 201 })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url'>>> {
  const out = new Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url'>>()
  if (ids.length === 0) return out

  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', Array.from(new Set(ids)))

  for (const p of (data ?? []) as Pick<Profile, 'id' | 'username' | 'avatar_url'>[]) {
    out.set(p.id, p)
  }
  return out
}

async function fetchLastMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationIds: string[]
): Promise<Map<string, Message>> {
  const out = new Map<string, Message>()
  if (conversationIds.length === 0) return out

  // Az `order/limit per group` PostgREST-ben nem trivi; a beszélgetések száma
  // egy useré gyakorlatban kicsi (<<100), így párhuzamos egyedi lekérés
  // egyszerűbb és olvashatóbb, mint egy DISTINCT ON RPC bevezetése.
  const results = await Promise.all(
    conversationIds.map(async (id) => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return { id, message: (data as Message | null) ?? null }
    })
  )

  for (const { id, message } of results) {
    if (message) out.set(id, message)
  }
  return out
}

async function fetchUnreadCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationIds: string[],
  userId: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (conversationIds.length === 0) return out

  const { data } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .is('read_at', null)

  for (const row of (data ?? []) as Array<{ conversation_id: string }>) {
    out.set(row.conversation_id, (out.get(row.conversation_id) ?? 0) + 1)
  }
  return out
}
