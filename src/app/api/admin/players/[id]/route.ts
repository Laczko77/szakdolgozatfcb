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
 * by the API-Football sync job: `bio` (text), `image` (optional File), and
 * `removeImage` (optional flag).
 *
 * Synced columns (name, position, number, stats, season, api_football_id)
 * are intentionally NOT mutable here — they would be clobbered on the next
 * sync run anyway.
 *
 * Image handling rules:
 *   - If `image` is supplied: upload to player-images, then swap the URL.
 *     The previously stored image (if it lived in our bucket) is deleted
 *     after the DB update succeeds (best-effort cleanup).
 *   - Else if `removeImage === "true"` (form field): set image_url = NULL
 *     and delete the old object from player-images. New uploads take
 *     precedence over removeImage if both are sent in the same request.
 *   - Else: image_url is left untouched.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  // Support both multipart/form-data (image upload) and application/json
  // (removeImage flag sent without a file). The frontend sends JSON when only
  // a flag is needed and multipart when a file is included.
  const contentType = request.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  let bio: string | null | undefined
  let image: File | null
  let removeImage: boolean

  if (isJson) {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('Érvénytelen JSON tartalom', 400)
    }
    if (typeof body !== 'object' || body === null) {
      return errorResponse('Érvénytelen kérés tartalom', 400)
    }
    const obj = body as Record<string, unknown>
    bio = obj.bio === undefined
      ? undefined
      : (typeof obj.bio === 'string' && obj.bio.trim().length > 0)
          ? obj.bio.trim()
          : null
    image = null
    removeImage = obj.removeImage === true
  } else {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
    }
    bio = readNullableString(formData, 'bio')
    image = readFile(formData, 'image')
    removeImage = readBoolean(formData, 'removeImage')
  }

  // No-op guard: if neither field was supplied we have nothing to do.
  if (bio === undefined && !image && !removeImage) {
    return errorResponse(
      'Legalább egy mező megadása szükséges (bio, image vagy removeImage)',
      400
    )
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
  if (nextImageUrl !== undefined) {
    update.image_url = nextImageUrl
  } else if (removeImage) {
    // Explicit clear: only honored when no replacement image was uploaded.
    update.image_url = null
  }

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

  // DB succeeded — clean up the previous image if it was replaced or
  // explicitly removed AND it lived in our bucket (we don't try to "delete"
  // external API-Football URLs — safeDeleteImage no-ops when the URL does
  // not point at the player-images bucket).
  const previousImageUrl = existing.image_url
  const imageWasReplaced =
    nextImageUrl !== undefined &&
    !!previousImageUrl &&
    previousImageUrl !== nextImageUrl
  const imageWasRemoved =
    nextImageUrl === undefined && removeImage && !!previousImageUrl

  if (imageWasReplaced || imageWasRemoved) {
    void safeDeleteImage(previousImageUrl as string)
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

/**
 * Read a boolean-flag form field. Treats only the literal strings "true"
 * and "1" (case-insensitive) as true — everything else, including missing
 * field, is false. Keeps the contract narrow so callers cannot accidentally
 * trigger a destructive action by sending the field with an empty value.
 */
function readBoolean(form: FormData, key: string): boolean {
  const value = form.get(key)
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}
