import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type { Comment, TablesInsert } from '@/types/database'

/**
 * /api/posts/[id]/comments
 *
 * GET  — public, lists comments under a post sorted by popularity
 *        (reaction count desc, then created_at desc as tie-breaker).
 *        Each comment is enriched with `reactions` (per-emoji counts) and
 *        `reactionTotal`.
 * POST — authenticated, creates a comment under the post on behalf of the
 *        current user.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

type EnrichedComment = Comment & {
  reactions: Record<string, number>
  reactionTotal: number
}

// ---------------------------------------------------------------------------
// GET — list (public)
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params
  if (!postId) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: commentsRaw, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(`Kommentek lekérése sikertelen: ${error.message}`, 500)
  }

  const comments = (commentsRaw ?? []) as Comment[]
  const commentIds = comments.map((c) => c.id)

  // Fetch all reactions for the loaded comments in one round-trip.
  let reactionsRaw: Array<{ target_id: string; emoji: string }> = []
  if (commentIds.length > 0) {
    const { data, error: reactionError } = await supabase
      .from('reactions')
      .select('target_id, emoji')
      .eq('target_type', 'comment')
      .in('target_id', commentIds)

    if (reactionError) {
      return errorResponse(
        `Reakciók lekérése sikertelen: ${reactionError.message}`,
        500
      )
    }
    reactionsRaw = (data ?? []) as Array<{ target_id: string; emoji: string }>
  }

  const reactionsByComment: Record<string, Record<string, number>> = {}
  const totalByComment: Record<string, number> = {}
  for (const row of reactionsRaw) {
    const bucket = (reactionsByComment[row.target_id] ??= {})
    bucket[row.emoji] = (bucket[row.emoji] ?? 0) + 1
    totalByComment[row.target_id] = (totalByComment[row.target_id] ?? 0) + 1
  }

  const enriched: EnrichedComment[] = comments
    .map((c) => ({
      ...c,
      reactions: reactionsByComment[c.id] ?? {},
      reactionTotal: totalByComment[c.id] ?? 0,
    }))
    // Popularity sort: reactionTotal desc, then created_at desc as tie-break.
    .sort((a, b) => {
      if (b.reactionTotal !== a.reactionTotal) {
        return b.reactionTotal - a.reactionTotal
      }
      return b.created_at.localeCompare(a.created_at)
    })

  return NextResponse.json({
    comments: enriched,
    total: enriched.length,
  })
}

// ---------------------------------------------------------------------------
// POST — create (authenticated)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { id: postId } = await context.params
  if (!postId) return errorResponse('Hiányzó azonosító', 400)

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

  const contentRaw = candidate.content
  if (typeof contentRaw !== 'string') {
    return errorResponse('A "content" mező kötelező', 400)
  }
  const content = contentRaw.trim()
  if (content.length === 0) {
    return errorResponse('A komment nem lehet üres', 400)
  }

  const supabase = await createClient()

  // Make sure the post exists; otherwise FK violation surfaces as 500.
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle()
  if (postError) {
    return errorResponse(`Poszt lekérése sikertelen: ${postError.message}`, 500)
  }
  if (!post) {
    return errorResponse('A poszt nem található', 404)
  }

  const insert: TablesInsert<'comments'> = {
    post_id: postId,
    user_id: user.id,
    content,
  }

  const { data, error } = await supabase
    .from('comments')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Komment létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Comment, 201)
}
