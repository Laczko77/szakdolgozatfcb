import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { deleteFile, uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS, isArticleCategory } from '@/lib/constants'
import type { Article, TablesUpdate } from '@/types/database'

/**
 * /api/articles/[id]
 *
 * GET    — public, returns one article by id (404 if missing).
 * PUT    — admin only, partial update with optional image replacement.
 * DELETE — admin only, removes the article and its image (if any).
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * Strict UUID v1-v5 shape. Postgres rejects non-UUID strings on a `uuid`
 * column with SQLSTATE `22P02` (invalid_text_representation), which used to
 * surface as a 500 because the Supabase client returns it untyped. We pre-
 * validate to short-circuit those calls cleanly into a 404 — the resource
 * doesn't exist, period — and we map any 22P02 that still slips through to
 * 404 in the post-query handler as a defence in depth.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

function isInvalidUuidError(error: { code?: string } | null): boolean {
  return error?.code === '22P02'
}

// ---------------------------------------------------------------------------
// GET — public detail
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)
  if (!isUuid(id)) return errorResponse('A cikk nem található', 404)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (isInvalidUuidError(error)) {
      return errorResponse('A cikk nem található', 404)
    }
    return errorResponse(`Cikk lekérése sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('A cikk nem található', 404)
  }

  return NextResponse.json(data as Article)
}

// ---------------------------------------------------------------------------
// PUT — update (admin)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)
  if (!isUuid(id)) return errorResponse('A cikk nem található', 404)

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

  if (categoryRaw !== null && !isArticleCategory(categoryRaw)) {
    return errorResponse('Érvénytelen kategória', 400)
  }

  const supabase = await createClient()

  // Fetch the existing row so we can (a) 404 cleanly, and (b) clean up the
  // previous image if a new one is uploaded.
  const { data: existingRaw, error: fetchError } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    if (isInvalidUuidError(fetchError)) {
      return errorResponse('A cikk nem található', 404)
    }
    return errorResponse(`Cikk lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A cikk nem található', 404)
  }
  const existing = existingRaw as Article

  // Image replacement: upload new first, only delete old after the new one
  // succeeds. This avoids leaving the article with a broken image_url if the
  // upload fails mid-flight.
  let nextImageUrl: string | null | undefined = undefined
  if (image) {
    try {
      nextImageUrl = await uploadFile(STORAGE_BUCKETS.articleImages, image)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
        500
      )
    }
  }

  const update: TablesUpdate<'articles'> = {
    updated_at: new Date().toISOString(),
  }
  if (title !== null) update.title = title
  if (content !== null) update.content = content
  if (categoryRaw !== null) update.category = categoryRaw
  if (nextImageUrl !== undefined) update.image_url = nextImageUrl

  const { data, error } = await supabase
    .from('articles')
    // See note in POST handler: cast at the SDK boundary; `update` itself
    // is strongly typed as TablesUpdate<'articles'>.
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    // The new image (if any) is already in Storage. Try to clean it up so we
    // don't accumulate orphans. Best-effort — swallow secondary errors.
    if (nextImageUrl) {
      void safeDeleteImage(nextImageUrl)
    }
    return errorResponse(
      `Cikk frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  // DB update succeeded — now remove the old image, if it was replaced.
  if (nextImageUrl && existing.image_url && existing.image_url !== nextImageUrl) {
    void safeDeleteImage(existing.image_url)
  }

  return successResponse(data as Article)
}

// ---------------------------------------------------------------------------
// DELETE — remove (admin)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)
  if (!isUuid(id)) return errorResponse('A cikk nem található', 404)

  const supabase = await createClient()

  // Look up first so we know whether to 404 and so we can clean up the image.
  const { data: existingRaw, error: fetchError } = await supabase
    .from('articles')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    if (isInvalidUuidError(fetchError)) {
      return errorResponse('A cikk nem található', 404)
    }
    return errorResponse(`Cikk lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A cikk nem található', 404)
  }
  const existing = existingRaw as Pick<Article, 'image_url'>

  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return errorResponse(`Cikk törlése sikertelen: ${deleteError.message}`, 500)
  }

  // Best-effort image cleanup. Don't fail the request if Storage hiccups.
  if (existing.image_url) {
    void safeDeleteImage(existing.image_url)
  }

  return NextResponse.json({ success: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeDeleteImage(url: string): Promise<void> {
  try {
    await deleteFile(STORAGE_BUCKETS.articleImages, url)
  } catch {
    // Swallow — orphaned Storage objects are recoverable; the user request isn't.
  }
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
