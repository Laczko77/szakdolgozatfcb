/**
 * Pure helpers extracted from `./route.ts` so they can be unit-tested
 * independently of the Next.js request lifecycle. Next.js App Router
 * disallows non-handler exports from route.ts files, hence this sibling
 * `_helpers.ts` file (mirrors the `_validation.ts` pattern used in
 * `src/app/api/dream-team/`).
 */

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
export function escapeIlike(input: string): string {
  return input
    .replace(/[\\]/g, '\\\\')
    .replace(/[%_]/g, (m) => `\\${m}`)
    .replace(/,/g, '\\,')
    .replace(/[()]/g, ' ')
    .trim()
}

export function clampInt(
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
