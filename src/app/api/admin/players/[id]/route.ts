import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import { deleteFile, uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type { Player, TablesUpdate } from '@/types/database'

/**
 * /api/admin/players/[id]
 *
 * PUT — admin only, manual editor for the small subset of fields not owned
 * by the API-Football sync job: `bio` (text) and `image` (optional File).
 *
 * Synced columns (name, position, number, stats, season, api_football_id)
 * are intentionally NOT mutable here — they would be clobbered on the next
 * sync run anyway. If the admin uploads a new image, the previous one is
 * deleted from Storage AFTER the DB update succeeds (best-effort cleanup).
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

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

  const bio = readNullableString(formData, 'bio')
  const image = readFile(formData, 'image')

  // No-op guard: if neither field was supplied we have nothing to do.
  if (bio === undefined && !image) {
    return errorResponse('Legalább egy mező megadása szükséges (bio vagy image)', 400)
  }

  const supabase = await createClient()

  // Fetch existing row so we can 404 cleanly and clean up the old image.
  const { data: existingRaw, error: fetchError } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Játékos lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A játékos nem található', 404)
  }
  const existing = existingRaw as Player

  // Upload new image first — only swap the URL after upload succeeds.
  let nextImageUrl: string | undefined = undefined
  if (image) {
    try {
      nextImageUrl = await uploadFile(STORAGE_BUCKETS.playerImages, image)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Képfeltöltés sikertelen',
        500
      )
    }
  }

  const update: TablesUpdate<'players'> = {
    updated_at: new Date().toISOString(),
  }
  if (bio !== undefined) update.bio = bio
  if (nextImageUrl !== undefined) update.image_url = nextImageUrl

  const { data, error } = await supabase
    .from('players')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    // Roll back the orphaned image upload, best-effort.
    if (nextImageUrl) {
      void safeDeleteImage(nextImageUrl)
    }
    return errorResponse(
      `Játékos frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  // DB succeeded — clean up the previous image if it was replaced AND it
  // lived in our bucket (we don't try to "delete" external API-Football URLs).
  if (
    nextImageUrl &&
    existing.image_url &&
    existing.image_url !== nextImageUrl
  ) {
    void safeDeleteImage(existing.image_url)
  }

  return successResponse(data as Player)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeDeleteImage(url: string): Promise<void> {
  try {
    await deleteFile(STORAGE_BUCKETS.playerImages, url)
  } catch {
    // Best-effort. Orphaned objects are recoverable via a future cleanup job.
  }
}

/**
 * Read a string field that, when present in the form, may legitimately be
 * empty (e.g. clearing a bio). Returns:
 *   - `undefined` when the field was not submitted at all
 *   - `null`      when an empty string was submitted (clear)
 *   - `string`    when non-empty content was submitted
 */
function readNullableString(form: FormData, key: string): string | null | undefined {
  const value = form.get(key)
  if (value === null) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (value instanceof File && value.size > 0) return value
  return null
}
