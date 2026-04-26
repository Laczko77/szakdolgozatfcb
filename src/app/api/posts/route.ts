import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Post } from '@/types/database'

/**
 * /api/posts
 *
 * GET — public, paginated list of posts (newest first).
 *
 * Each post is enriched with:
 *   - reactions:    { [emoji]: number }     — count per emoji
 *   - reactionTotal: number                  — total reaction count
 *   - commentCount:  number
 *
 * Optional `since` query param (ISO timestamp) filters to posts created at or
 * after that moment — used by the frontend's 3-second polling to avoid
 * re-downloading the entire feed on each tick.
 */

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type EnrichedPost = Post & {
  reactions: Record<string, number>
  reactionTotal: number
  commentCount: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const page = clampInt(searchParams.get('page'), DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)

  const sinceRaw = searchParams.get('since')
  let since: string | null = null
  if (sinceRaw !== null) {
    const parsed = new Date(sinceRaw)
    if (Number.isNaN(parsed.getTime())) {
      return errorResponse('Érvénytelen "since" timestamp', 400)
    }
    since = parsed.toISOString()
  }

  const supabase = await createClient()

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (since) {
    query = query.gte('created_at', since)
  }

  const { data: postsRaw, error, count } = await query

  if (error) {
    return errorResponse(`Posztok lekérése sikertelen: ${error.message}`, 500)
  }

  const posts = (postsRaw ?? []) as Post[]

  // Aggregate reactions and comment counts in two batched queries (one each)
  // rather than N+1 — the page is small enough that this is always faster.
  const postIds = posts.map((p) => p.id)

  const enrichment = await fetchEnrichment(supabase, postIds)

  const enriched: EnrichedPost[] = posts.map((post) => ({
    ...post,
    reactions: enrichment.reactionsByPost[post.id] ?? {},
    reactionTotal: enrichment.reactionTotalByPost[post.id] ?? 0,
    commentCount: enrichment.commentCountByPost[post.id] ?? 0,
  }))

  const total = count ?? 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return NextResponse.json({
    posts: enriched,
    total,
    page,
    totalPages,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Enrichment = {
  reactionsByPost: Record<string, Record<string, number>>
  reactionTotalByPost: Record<string, number>
  commentCountByPost: Record<string, number>
}

async function fetchEnrichment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postIds: string[]
): Promise<Enrichment> {
  if (postIds.length === 0) {
    return { reactionsByPost: {}, reactionTotalByPost: {}, commentCountByPost: {} }
  }

  const reactionsByPost: Record<string, Record<string, number>> = {}
  const reactionTotalByPost: Record<string, number> = {}
  const commentCountByPost: Record<string, number> = {}

  const [{ data: reactionsRaw }, { data: commentsRaw }] = await Promise.all([
    supabase
      .from('reactions')
      .select('target_id, emoji')
      .eq('target_type', 'post')
      .in('target_id', postIds),
    supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds),
  ])

  for (const row of (reactionsRaw ?? []) as Array<{ target_id: string; emoji: string }>) {
    const bucket = (reactionsByPost[row.target_id] ??= {})
    bucket[row.emoji] = (bucket[row.emoji] ?? 0) + 1
    reactionTotalByPost[row.target_id] = (reactionTotalByPost[row.target_id] ?? 0) + 1
  }

  for (const row of (commentsRaw ?? []) as Array<{ post_id: string }>) {
    commentCountByPost[row.post_id] = (commentCountByPost[row.post_id] ?? 0) + 1
  }

  return { reactionsByPost, reactionTotalByPost, commentCountByPost }
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}
