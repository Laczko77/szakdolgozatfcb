import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { deleteFile, uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type { Post, TablesUpdate } from '@/types/database'

/**
 * /api/admin/posts/[id]
 *
 * PUT    — admin only, partial update with optional image replacement.
 * DELETE — admin only, removes the post and its image (if any).
 *          Cascades cover comments and reactions on the post itself; reactions
 *          targeting the post (target_type='post') are NOT FK-linked, so we
 *          remove them explicitly.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// PUT — update (admin)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
  }

  const content = readString(formData, 'content')
  const image = readFile(formData, 'image')

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Poszt lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A poszt nem található', 404)
  }
  const existing = existingRaw as Post

  let nextImageUrl: string | null | undefined = undefined
  if (image) {
    try {
      nextImageUrl = await uploadFile(STORAGE_BUCKETS.postImages, image)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
        500
      )
    }
  }

  const update: TablesUpdate<'posts'> = {}
  if (content !== null) update.content = content
  if (nextImageUrl !== undefined) update.image_url = nextImageUrl

  if (Object.keys(update).length === 0) {
    // Nothing to update — surface the existing row instead of issuing a no-op write.
    return successResponse(existing)
  }

  const { data, error } = await supabase
    .from('posts')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    if (nextImageUrl) {
      void safeDeleteImage(nextImageUrl)
    }
    return errorResponse(
      `Poszt frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  if (nextImageUrl && existing.image_url && existing.image_url !== nextImageUrl) {
    void safeDeleteImage(existing.image_url)
  }

  return successResponse(data as Post)
}

// ---------------------------------------------------------------------------
// DELETE — remove (admin)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('posts')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Poszt lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A poszt nem található', 404)
  }
  const existing = existingRaw as Pick<Post, 'image_url'>

  // reactions has a polymorphic target — no FK on posts. Clean up post reactions
  // explicitly so they don't dangle. (Comment reactions are removed below as a
  // batch keyed off the cascading-deleted comment ids.)
  const { data: commentIdsRaw } = await supabase
    .from('comments')
    .select('id')
    .eq('post_id', id)

  const commentIds = (commentIdsRaw ?? []).map((c) => (c as { id: string }).id)

  await supabase
    .from('reactions')
    .delete()
    .eq('target_type', 'post')
    .eq('target_id', id)

  if (commentIds.length > 0) {
    await supabase
      .from('reactions')
      .delete()
      .eq('target_type', 'comment')
      .in('target_id', commentIds)
  }

  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return errorResponse(`Poszt törlése sikertelen: ${deleteError.message}`, 500)
  }

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
    await deleteFile(STORAGE_BUCKETS.postImages, url)
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
