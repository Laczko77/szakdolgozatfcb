import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { uploadFile } from '@/lib/storage'
import {
  STORAGE_BUCKETS,
  isArticleCategory,
} from '@/lib/constants'
import type { Article, TablesInsert } from '@/types/database'

/**
 * /api/articles
 *
 * GET  — public, paginated list with optional category filter.
 * POST — admin only, accepts multipart/form-data with optional image upload.
 */

// ---------------------------------------------------------------------------
// GET — public list
// ---------------------------------------------------------------------------

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const page = clampInt(searchParams.get('page'), DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER)
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const category = searchParams.get('category')

  if (category !== null && !isArticleCategory(category)) {
    return errorResponse('Érvénytelen kategória', 400)
  }

  const supabase = await createClient()

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error, count } = await query

  if (error) {
    return errorResponse(`Cikkek lekérése sikertelen: ${error.message}`, 500)
  }

  const total = count ?? 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return NextResponse.json({
    articles: (data ?? []) as Article[],
    total,
    page,
    totalPages,
  })
}

// ---------------------------------------------------------------------------
// POST — create (admin)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
  }

  const title = readString(formData, 'title')
  const content = readString(formData, 'content')
  const categoryRaw = readString(formData, 'category')
  const image = readFile(formData, 'image')

  if (!title) return errorResponse('A "title" mező kötelező', 400)
  if (!content) return errorResponse('A "content" mező kötelező', 400)
  if (!categoryRaw) return errorResponse('A "category" mező kötelező', 400)
  if (!isArticleCategory(categoryRaw)) {
    return errorResponse('Érvénytelen kategória', 400)
  }

  // Upload image first (if provided). Failing here means we abort before INSERT.
  let imageUrl: string | null = null
  if (image) {
    try {
      imageUrl = await uploadFile(STORAGE_BUCKETS.articleImages, image)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
        500
      )
    }
  }

  const supabase = await createClient()

  const insert: TablesInsert<'articles'> = {
    title,
    content,
    category: categoryRaw,
    image_url: imageUrl,
    author_id: user.id,
  }

  const { data, error } = await supabase
    .from('articles')
    // The hand-written Database type narrows Insert payloads to `never` for
    // some tables; cast at the SDK boundary while keeping `insert` itself
    // strongly typed as TablesInsert<'articles'>.
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Cikk létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Article, 201)
}

// ---------------------------------------------------------------------------
// FormData helpers
// ---------------------------------------------------------------------------

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
