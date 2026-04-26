import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type { Post, TablesInsert } from '@/types/database'

/**
 * /api/admin/posts
 *
 * POST — admin only, accepts multipart/form-data with optional image upload.
 *        Body: content (required), image (optional file → post-images bucket).
 */

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

  const content = readString(formData, 'content')
  const image = readFile(formData, 'image')

  if (!content) return errorResponse('A "content" mező kötelező', 400)

  // Upload image first so a Storage failure aborts before the INSERT.
  let imageUrl: string | null = null
  if (image) {
    try {
      imageUrl = await uploadFile(STORAGE_BUCKETS.postImages, image)
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

  return successResponse(data as Post, 201)
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
