import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import { deleteFile, uploadFile } from '@/lib/storage'
import { STORAGE_BUCKETS } from '@/lib/constants'
import type { Profile } from '@/types/database'
import { readBool, readFile } from './_helpers'

/**
 * /api/profile
 *
 * GET — authenticated, returns the caller's profile row.
 * PUT — authenticated, updates username and/or avatar. Accepts
 *       multipart/form-data so a new avatar image can be uploaded in the
 *       same request. The previous avatar is best-effort deleted from
 *       Storage when replaced.
 *
 * Password changes live at /api/profile/password (separate Auth call).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USERNAME_MIN = 2
const USERNAME_MAX = 32

// ---------------------------------------------------------------------------
// GET — caller's profile
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { profile } = guard

  return successResponse(profile)
}

// ---------------------------------------------------------------------------
// PUT — update username + avatar
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user, profile } = guard

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Érvénytelen multipart/form-data tartalom', 400)
  }

  const usernameRaw = formData.get('username')
  const avatar = readFile(formData, 'avatar')
  const removeAvatar = readBool(formData, 'remove_avatar')

  // Validate the requested update set: at least one of the three fields must
  // be present, otherwise the call is a no-op.
  const wantsUsernameChange = typeof usernameRaw === 'string'
  if (!wantsUsernameChange && !avatar && !removeAvatar) {
    return errorResponse(
      'Legalább egy mezőt módosítani kell (username, avatar, remove_avatar)',
      400
    )
  }

  // Username validation (only when supplied).
  let username: string | null | undefined = undefined
  if (wantsUsernameChange) {
    const trimmed = usernameRaw.trim()
    if (trimmed.length === 0) {
      // Allow clearing the username back to NULL.
      username = null
    } else if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
      return errorResponse(
        `A felhasználónév ${USERNAME_MIN}-${USERNAME_MAX} karakter között kell legyen`,
        400
      )
    } else {
      username = trimmed
    }
  }

  // Upload new avatar (if any). On failure we abort before the DB update so
  // nothing partial is committed.
  let newAvatarUrl: string | null | undefined = undefined
  if (avatar) {
    try {
      newAvatarUrl = await uploadFile(STORAGE_BUCKETS.profileImages, avatar)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Profilkép feltöltése sikertelen',
        500
      )
    }
  } else if (removeAvatar) {
    newAvatarUrl = null
  }

  // Build the update payload — only include fields the caller actually
  // touched, so we don't accidentally NULL out unrelated columns.
  const update: Partial<Profile> = {}
  if (username !== undefined) update.username = username
  if (newAvatarUrl !== undefined) update.avatar_url = newAvatarUrl

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .update(update as never)
    .eq('id', user.id)
    .select('*')
    .single()

  if (error || !data) {
    // Roll back: if we uploaded a new avatar but the DB update failed, drop
    // the orphaned file rather than leaving it in storage.
    if (avatar && typeof newAvatarUrl === 'string') {
      try {
        await deleteFile(STORAGE_BUCKETS.profileImages, newAvatarUrl)
      } catch {
        // Best-effort cleanup; ignore.
      }
    }
    return errorResponse(
      `Profil frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  // Best-effort cleanup of the previous avatar (only when it was actually
  // replaced — and only if it lived in our profile-images bucket).
  if (
    newAvatarUrl !== undefined &&
    profile.avatar_url &&
    profile.avatar_url !== newAvatarUrl
  ) {
    try {
      await deleteFile(STORAGE_BUCKETS.profileImages, profile.avatar_url)
    } catch {
      // Non-fatal; the new profile is already saved.
    }
  }

  return successResponse(data as Profile)
}

