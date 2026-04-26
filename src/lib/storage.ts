import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Reusable Supabase Storage helpers.
 *
 * Uses the service-role client because:
 *   1. We want a single code path for both anonymous-uploaded content (e.g.
 *      profile avatars) and admin-uploaded content (articles, products).
 *   2. Storage RLS is intentionally permissive on read but write policies are
 *      not yet in place for every bucket — going through service role lets
 *      callers (which are already auth-guarded at the route handler) trust
 *      that the upload will succeed regardless of bucket policy state.
 *
 * NEVER call these helpers directly from a Client Component. They depend on
 * SUPABASE_SERVICE_ROLE_KEY which must remain server-side.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type UploadedFile = {
  /** Object path inside the bucket (relative). */
  path: string
  /** Public URL — usable directly from <img src="..."> or <Image src="..."> */
  url: string
}

/**
 * Upload a File (Web API) to a bucket.
 *
 * @param bucket  Bucket id (see STORAGE_BUCKETS in `@/lib/constants`).
 * @param file    File from `formData.get('image')` etc.
 * @param path    Optional object path. When omitted we generate `{uuid}.{ext}`
 *                from the file's original name.
 * @returns       The object's public URL.
 *
 * Throws on Supabase errors so the caller can map them to HTTP responses.
 */
export async function uploadFile(
  bucket: string,
  file: File,
  path?: string
): Promise<string> {
  const supabase = createServiceRoleClient()

  const objectPath = path ?? generateObjectPath(file.name)

  // File extends Blob, which is what supabase-js expects. We pass the raw
  // File so the SDK forwards content-type from the file metadata.
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)

  if (!data?.publicUrl) {
    throw new Error('Storage upload succeeded but public URL is missing')
  }

  return data.publicUrl
}

/**
 * Delete an object from a bucket using its public URL.
 *
 * Idempotent-ish: if the object does not exist, Supabase returns a non-fatal
 * response and we swallow it. We DO surface other errors so the caller can
 * decide how to react (e.g. log but continue).
 */
export async function deleteFile(bucket: string, url: string): Promise<void> {
  const path = objectPathFromUrl(bucket, url)
  if (!path) return // URL did not point at this bucket — nothing to do.

  const supabase = createServiceRoleClient()
  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    // Don't throw on "not found" — treat delete as idempotent.
    if (error.message?.toLowerCase().includes('not found')) return
    throw new Error(`Storage delete failed: ${error.message}`)
  }
}

/**
 * Extract the final path segment from a URL (the file name, including
 * extension). Useful when the object path is a flat `{uuid}.{ext}`.
 */
export function fileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    return segments[segments.length - 1] ?? ''
  } catch {
    // Not a valid URL — fall back to last `/` segment.
    const idx = url.lastIndexOf('/')
    return idx >= 0 ? url.slice(idx + 1) : url
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Generate a flat object path: `{uuid}.{ext}`.
 * Falls back to no extension if the original name has none.
 */
function generateObjectPath(originalName: string): string {
  const ext = extensionOf(originalName)
  return ext ? `${randomUUID()}.${ext}` : randomUUID()
}

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return null
  return name.slice(dot + 1).toLowerCase()
}

/**
 * Reverse-engineer the in-bucket object path from a Supabase public URL.
 *
 * Supabase public URLs look like:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * Returns null if the URL does not contain `/<bucket>/` after the public prefix.
 */
function objectPathFromUrl(bucket: string, url: string): string | null {
  try {
    const parsed = new URL(url)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = parsed.pathname.indexOf(marker)
    if (idx === -1) {
      // Fall back to assuming the last segment is the object key (legacy/manual URLs).
      const fileName = fileNameFromUrl(url)
      return fileName || null
    }
    return parsed.pathname.slice(idx + marker.length)
  } catch {
    return null
  }
}
