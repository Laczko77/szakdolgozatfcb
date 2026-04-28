import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Message } from '@/types/database'

/**
 * Realtime helpers for the DM feature (Iteration 18).
 *
 * These wrap supabase-js channel subscriptions with stable channel names and
 * server-side filters so the frontend doesn't have to remember the exact
 * postgres_changes payload shape.
 *
 * Usage:
 *   const channel = subscribeToConversation(supabase, conversationId, msg => ...)
 *   // ... later
 *   channel.unsubscribe()
 */

type SupabaseBrowserClient = SupabaseClient<Database>

/**
 * Subscribe to INSERTs on a single conversation.
 * The server-side filter ensures only this conversation's messages are
 * delivered, so RLS + Realtime cooperate to keep the stream private.
 */
export function subscribeToConversation(
  supabase: SupabaseBrowserClient,
  conversationId: string,
  onNewMessage: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onNewMessage(payload.new as Message)
    )
    .subscribe()
}

/**
 * Subscribe to read_at UPDATEs on a single conversation — useful for showing
 * "seen" indicators on sent messages without needing a second poll.
 */
export function subscribeToReadReceipts(
  supabase: SupabaseBrowserClient,
  conversationId: string,
  onReadUpdate: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`conversation-reads:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onReadUpdate(payload.new as Message)
    )
    .subscribe()
}
