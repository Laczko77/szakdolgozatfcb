import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type {
  Article,
  Player,
  Post,
  Product,
} from '@/types/database'

/**
 * GET /api/search?q=...&limit=...
 *
 * Public, unauthenticated. Cross-table search across:
 *   - articles (title + content)
 *   - products (name + description)
 *   - players  (name)
 *   - posts    (content)
 *
 * Implementation note — we use ILIKE (case-insensitive substring) rather
 * than Postgres full-text search. Reasons:
 *   1. The schema has no `tsvector` columns or text-search indexes yet, so
 *      `to_tsvector(...) @@ plainto_tsquery(...)` would fall back to a
 *      sequential scan with no real ranking benefit.
 *   2. ILIKE matches partial words ("messi", "messi-style", "Messilla")
 *      which is what users intuitively expect for a fan-portal search box.
 *
 * The query string is sanitized for PostgREST `or()` syntax: we escape `%`
 * and `,` (PostgREST treats commas as filter separators) and wrap the term
 * in `%...%` for substring matching.
 *
 * Results are returned grouped by type. Empty / whitespace-only query
 * returns empty groups (the frontend renders an "ide írj keresőszót"
 * placeholder in that case).
 */

const DEFAULT_LIMIT_PER_GROUP = 10
const MAX_LIMIT_PER_GROUP = 50
const MIN_QUERY_LENGTH = 2

type SearchResults = {
  query: string
  articles: Article[]
  products: Product[]
  players: Player[]
  posts: Post[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawQuery = searchParams.get('q') ?? ''
  const limit = clampInt(
    searchParams.get('limit'),
    DEFAULT_LIMIT_PER_GROUP,
    1,
    MAX_LIMIT_PER_GROUP
  )

  const trimmed = rawQuery.trim()

  // Empty / too-short query: return well-formed empty groups so the client
  // can render consistently without a special-case branch.
  if (trimmed.length < MIN_QUERY_LENGTH) {
    const empty: SearchResults = {
      query: trimmed,
      articles: [],
      products: [],
      players: [],
      posts: [],
    }
    return NextResponse.json(empty)
  }

  const pattern = `%${escapeIlike(trimmed)}%`

  const supabase = await createClient()

  const [articlesRes, productsRes, playersRes, postsRes] = await Promise.all([
    supabase
      .from('articles')
      .select('id, title, content, category, image_url, author_id, created_at, updated_at')
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('products')
      .select('id, name, description, price, image_url, category, created_at')
      .or(`name.ilike.${pattern},description.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('players')
      .select('*')
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(limit),
    supabase
      .from('posts')
      .select('*')
      .ilike('content', pattern)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  // If any group errors out we still return the others — the search box
  // should degrade gracefully. We surface the first error in a `warnings`
  // field so it's debuggable.
  const warnings: string[] = []
  if (articlesRes.error) warnings.push(`articles: ${articlesRes.error.message}`)
  if (productsRes.error) warnings.push(`products: ${productsRes.error.message}`)
  if (playersRes.error) warnings.push(`players: ${playersRes.error.message}`)
  if (postsRes.error) warnings.push(`posts: ${postsRes.error.message}`)

  // If ALL groups failed, treat as a hard 500.
  if (
    articlesRes.error &&
    productsRes.error &&
    playersRes.error &&
    postsRes.error
  ) {
    return errorResponse(
      `Keresés sikertelen: ${warnings.join('; ')}`,
      500
    )
  }

  const result: SearchResults & { warnings?: string[] } = {
    query: trimmed,
    articles: (articlesRes.data ?? []) as Article[],
    products: (productsRes.data ?? []) as Product[],
    players: (playersRes.data ?? []) as Player[],
    posts: (postsRes.data ?? []) as Post[],
  }
  if (warnings.length > 0) result.warnings = warnings

  return NextResponse.json(result)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape user input for use inside a PostgREST `or(...)` filter expression
 * AND inside an ILIKE pattern.
 *
 * PostgREST: commas separate filters, parens delimit the or-list. We escape
 * commas with `\,`. Parens are dropped to avoid breaking the parser.
 *
 * SQL ILIKE: `%` and `_` are wildcards. We escape both so that a user
 * typing `50%` does not match every record.
 */
function escapeIlike(input: string): string {
  return input
    .replace(/[\\]/g, '\\\\')
    .replace(/[%_]/g, (m) => `\\${m}`)
    .replace(/,/g, '\\,')
    .replace(/[()]/g, ' ')
    .trim()
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
