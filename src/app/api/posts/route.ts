import { NextResponse, type NextRequest } from 'next/server'
import {
  createClient,
  createServiceRoleClient,
} from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import { consumeToken, getClientKey } from '@/lib/rate-limit'
import { uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type { Post, Profile, TablesInsert } from '@/types/database'

/**
 * /api/posts
 *
 * GET — public, paginated list of posts (newest first).
 *
 * Each post is enriched with:
 *   - author:        { id, username, avatar_url } | null
 *   - reactions:     { [emoji]: number }     — count per emoji
 *   - reactionTotal: number                  — total reaction count
 *   - commentCount:  number
 *
 * Optional `since` query param (ISO timestamp) filters to posts created at or
 * after that moment — used by the frontend's 3-second polling to avoid
 * re-downloading the entire feed on each tick.
 *
 * POST — authenticated user creates their own post (multipart/form-data).
 *        Body: content (1–2000 chars, required), image (optional file →
 *        post-images bucket under `{user_id}/...`).
 *        Admin posting still goes through /api/admin/posts (untouched).
 */

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const MAX_CONTENT_LENGTH = 2000

// Polling target: client polls every 3 s. Bucket of 30 with 1 token per second
// gives ~10× headroom for normal use while shutting down a runaway loop.
// The bucket is per-instance (see src/lib/rate-limit.ts).
const POLL_RATE_LIMIT = { capacity: 30, refillPerSecond: 1 }

type PublicAuthor = Pick<Profile, 'id' | 'username' | 'avatar_url'>

type EnrichedPost = Post & {
  author: PublicAuthor | null
  reactions: Record<string, number>
  reactionTotal: number
  commentCount: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Throttle the polling endpoint per caller. We don't have the user id at
  // this point (the route is public) so we key on IP. Authenticated callers
  // could be keyed by user id but the common abuser case is anon scrapers.
  const limitResult = consumeToken(
    `posts:${getClientKey(request, null)}`,
    POLL_RATE_LIMIT
  )
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: 'Túl sok kérés, próbáld újra később' },
      {
        status: 429,
        headers: { 'Retry-After': String(limitResult.retryAfter) },
      }
    )
  }

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

  // Aggregate reactions, comment counts, and author profiles in batched
  // queries (one each) rather than N+1.
  const postIds = posts.map((p) => p.id)
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)))

  const [enrichment, authorsById] = await Promise.all([
    fetchEnrichment(supabase, postIds),
    fetchAuthors(authorIds),
  ])

  const enriched: EnrichedPost[] = posts.map((post) => ({
    ...post,
    author: authorsById.get(post.author_id) ?? null,
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

export async function POST(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
  }

  const content = readString(formData, 'content')
  const image = readFile(formData, 'image')

  if (!content) {
    return errorResponse('A "content" mező kötelező', 400)
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return errorResponse(
      `A poszt szövege legfeljebb ${MAX_CONTENT_LENGTH} karakter lehet`,
      400
    )
  }

  // Upload image first so a Storage failure aborts before the INSERT.
  // Path convention: {user_id}/{timestamp}-{filename}. The Storage RLS
  // policy (post_images_insert_own_prefix) enforces the {user_id}/ prefix
  // even via the service-role client used inside uploadFile, but as a defense
  // in depth the path is constructed here, not from user input.
  let imageUrl: string | null = null
  if (image) {
    const safeName = sanitizeFileName(image.name)
    const path = `${user.id}/${Date.now()}-${safeName}`
    try {
      imageUrl = await uploadFile(STORAGE_BUCKETS.postImages, image, path)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
        500
      )
    }
  }

  const supabase = await createClient()

  const insert: TablesInsert<'posts'> = {
    author_id: user.id,
    content,
    image_url: imageUrl,
  }

  const { data, error } = await supabase
    .from('posts')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Poszt létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  // Author hydration — közvetlenül a hívó user-éből jön, nincs szükség
  // service-role lookup-ra.
  const authorsById = await fetchAuthors([user.id])

  const post = data as Post
  const enriched: EnrichedPost = {
    ...post,
    author: authorsById.get(post.author_id) ?? null,
    reactions: {},
    reactionTotal: 0,
    commentCount: 0,
  }

  return successResponse(enriched, 201)
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

/**
 * Author profilok lekérdezése service-role klienssel.
 *
 * Miért service-role: a profiles SELECT RLS policy
 * (`auth.uid() = id OR is_admin()`) miatt a normál (cookie-alapú) kliens csak
 * a saját profilt látná, így minden idegen poszt szerző nélkül érkezne a
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
    // Soft-fail: a JOIN hiánya nem dönti be az egész feed listát.
    console.error('[posts] author profile lookup failed:', error.message)
    return out
  }

  for (const row of (data ?? []) as PublicAuthor[]) {
    out.set(row.id, row)
  }
  return out
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

function readString(form: FormData, key: string): string | null {
  const value = form.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (value instanceof File && value.size > 0) return value
  return null
}

/**
 * Storage objektum kulcsban biztonságos fájlnév: csak alfanumerikus,
 * pont, kötőjel, aláhúzás. Egyéb karakterek `_`-szá alakulnak.
 * A timestamp prefix garantálja az egyediséget, így az ütközés nem gond.
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'upload'
}
