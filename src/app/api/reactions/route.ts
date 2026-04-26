import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type { Reaction, ReactionTarget, TablesInsert } from '@/types/database'

/**
 * /api/reactions
 *
 * POST — authenticated, add or swap a reaction.
 *
 *   Body (JSON): { target_type: 'post' | 'comment', target_id: string, emoji: string }
 *
 *   Behaviour: a user can have AT MOST ONE reaction per (target_type, target_id)
 *   — enforced by the UNIQUE (user_id, target_type, target_id) constraint.
 *     - No existing reaction       → INSERT.
 *     - Same emoji already there   → no-op, return existing row.
 *     - Different emoji            → UPDATE the emoji on the existing row
 *                                    (preserves the row id so DELETE links remain stable).
 */

const VALID_TARGET_TYPES: ReadonlySet<ReactionTarget> = new Set(['post', 'comment'])

// Hard cap on emoji length so we don't accept a paragraph in the field.
// Most graphemes for emoji (incl. ZWJ sequences) fit comfortably in 16 chars.
const MAX_EMOJI_LENGTH = 16

export async function POST(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

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

  const targetType = candidate.target_type
  const targetId = candidate.target_id
  const emojiRaw = candidate.emoji

  if (
    typeof targetType !== 'string' ||
    !VALID_TARGET_TYPES.has(targetType as ReactionTarget)
  ) {
    return errorResponse('A "target_type" csak "post" vagy "comment" lehet', 400)
  }
  if (typeof targetId !== 'string' || targetId.length === 0) {
    return errorResponse('A "target_id" mező kötelező', 400)
  }
  if (typeof emojiRaw !== 'string') {
    return errorResponse('Az "emoji" mező kötelező', 400)
  }
  const emoji = emojiRaw.trim()
  if (emoji.length === 0 || emoji.length > MAX_EMOJI_LENGTH) {
    return errorResponse('Érvénytelen emoji', 400)
  }

  const narrowedTargetType = targetType as ReactionTarget
  const supabase = await createClient()

  // Verify the target exists. Without this check a typo would silently insert
  // an orphan row (the polymorphic target_id has no FK).
  const { data: target, error: targetError } = await supabase
    .from(narrowedTargetType === 'post' ? 'posts' : 'comments')
    .select('id')
    .eq('id', targetId)
    .maybeSingle()
  if (targetError) {
    return errorResponse(
      `Cél lekérése sikertelen: ${targetError.message}`,
      500
    )
  }
  if (!target) {
    return errorResponse(
      narrowedTargetType === 'post'
        ? 'A poszt nem található'
        : 'A komment nem található',
      404
    )
  }

  // Existing reaction for the (user, target) pair?
  const { data: existingRaw, error: existingError } = await supabase
    .from('reactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('target_type', narrowedTargetType)
    .eq('target_id', targetId)
    .maybeSingle()

  if (existingError) {
    return errorResponse(
      `Reakció lekérése sikertelen: ${existingError.message}`,
      500
    )
  }

  if (existingRaw) {
    const existing = existingRaw as Reaction
    // Same emoji — idempotent no-op.
    if (existing.emoji === emoji) {
      return successResponse(existing)
    }
    // Different emoji — swap in place so the row id stays stable.
    const { data: updated, error: updateError } = await supabase
      .from('reactions')
      .update({ emoji } as never)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return errorResponse(
        `Reakció frissítése sikertelen: ${updateError?.message ?? 'ismeretlen hiba'}`,
        500
      )
    }
    return successResponse(updated as Reaction)
  }

  // No existing reaction — INSERT.
  const insert: TablesInsert<'reactions'> = {
    user_id: user.id,
    target_type: narrowedTargetType,
    target_id: targetId,
    emoji,
  }

  const { data, error } = await supabase
    .from('reactions')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    // 23505 = unique_violation (race against a concurrent reaction insert).
    if (error?.code === '23505') {
      return errorResponse('Erre a célra már reagáltál', 409)
    }
    return errorResponse(
      `Reakció létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Reaction, 201)
}
