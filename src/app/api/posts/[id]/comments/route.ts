import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import type { Comment, Profile, TablesInsert } from '@/types/database'

/**
 * /api/posts/[id]/comments
 *
 * GET  — public, lists comments under a post sorted by popularity
 *        (reaction count desc, then created_at desc as tie-breaker).
 *        Each comment is enriched with:
 *          - author:        { id, username, avatar_url } | null
 *          - reactions:     { [emoji]: number }
 *          - reactionTotal: number
 *
 * POST — authenticated, creates a comment under the post on behalf of the
 *        current user. A frissen létrehozott komment is a hídrált author
 *        mezővel tér vissza, hogy a frontend optimistic-render mehessen
 *        utólagos lookup nélkül.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

type PublicAuthor = Pick<Profile, 'id' | 'username' | 'avatar_url'>

type EnrichedComment = Comment & {
  author: PublicAuthor | null
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
  const authorIds = Array.from(new Set(comments.map((c) => c.user_id)))

  // Reactions + author profilok párhuzamosan.
  const [reactionsResult, authorsById] = await Promise.all([
    fetchReactions(supabase, commentIds),
    fetchAuthors(authorIds),
  ])

  if (reactionsResult instanceof NextResponse) return reactionsResult
  const { reactionsByComment, totalByComment } = reactionsResult

  const enriched: EnrichedComment[] = comments
    .map((c) => ({
      ...c,
      author: authorsById.get(c.user_id) ?? null,
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

  // Author hidratálás közvetlenül a hívó user-éből — nincs szükség
  // service-role lookup-ra.
  const authorsById = await fetchAuthors([user.id])

  const comment = data as Comment
  const enriched: EnrichedComment = {
    ...comment,
    author: authorsById.get(comment.user_id) ?? null,
    reactions: {},
    reactionTotal: 0,
  }

  return successResponse(enriched, 201)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchReactions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commentIds: string[]
): Promise<
  | {
      reactionsByComment: Record<string, Record<string, number>>
      totalByComment: Record<string, number>
    }
  | NextResponse
> {
  const reactionsByComment: Record<string, Record<string, number>> = {}
  const totalByComment: Record<string, number> = {}

  if (commentIds.length === 0) {
    return { reactionsByComment, totalByComment }
  }

  const { data, error } = await supabase
    .from('reactions')
    .select('target_id, emoji')
    .eq('target_type', 'comment')
    .in('target_id', commentIds)

  if (error) {
    return errorResponse(`Reakciók lekérése sikertelen: ${error.message}`, 500)
  }

  for (const row of (data ?? []) as Array<{ target_id: string; emoji: string }>) {
    const bucket = (reactionsByComment[row.target_id] ??= {})
    bucket[row.emoji] = (bucket[row.emoji] ?? 0) + 1
    totalByComment[row.target_id] = (totalByComment[row.target_id] ?? 0) + 1
  }

  return { reactionsByComment, totalByComment }
}

/**
 * Author profilok lekérdezése service-role klienssel.
 *
 * Miért service-role: a profiles SELECT RLS policy
 * (`auth.uid() = id OR is_admin()`) miatt a normál (cookie-alapú) kliens csak
 * a saját profilt látná, így minden idegen komment szerző nélkül érkezne a
 * frontendre. Csak a publikus mezőket adjuk vissza (id, username,
 * avatar_url), bizalmas mező nem szivárog.
 */
async function fetchAuthors(
  authorIds: string[]
): Promise<Map<string, PublicAuthor>> {
  const out = new Map<string, PublicAuthor>()
  if (authorIds.length === 0) return out

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', authorIds)

  if (error) {
    console.error('[comments] author profile lookup failed:', error.message)
    return out
  }

  for (const row of (data ?? []) as PublicAuthor[]) {
    out.set(row.id, row)
  }
  return out
}
