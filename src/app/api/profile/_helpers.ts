/**
 * Pure helpers extracted from `./route.ts` so they can be unit-tested
 * independently of the Next.js request lifecycle. Next.js App Router
 * disallows non-handler exports from route.ts files, hence this sibling
 * `_helpers.ts` file (mirrors the `_validation.ts` pattern used in
 * `src/app/api/dream-team/`).
 */

export function readFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (value instanceof File && value.size > 0) return value
  return null
}

export function readBool(form: FormData, key: string): boolean {
  const value = form.get(key)
  if (typeof value !== 'string') return false
  const v = value.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}
