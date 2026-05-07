/**
 * Pure helpers extracted from `./route.ts` so they can be unit-tested
 * independently of the Next.js request lifecycle. Next.js App Router
 * disallows non-handler exports from route.ts files, hence this sibling
 * `_helpers.ts` file (mirrors the `_validation.ts` pattern used in
 * `src/app/api/dream-team/`).
 */

/**
 * Translate a Postgres P0001 message raised inside redeem_coupon() to a
 * frontend-friendly status + Hungarian error message.
 *
 * The DB-side strings are stable contract: see migration 010_iter10_coupons.sql.
 */
export function mapBusinessRuleError(rawMessage: string): {
  status: number
  message: string
} {
  const msg = rawMessage.toLowerCase()

  // Coupon row missing entirely.
  if (msg.includes('nem található')) {
    return { status: 404, message: 'Kupon nem található' }
  }

  // Coupon is_active = false.
  if (msg.includes('nem érhető el')) {
    return { status: 400, message: 'Ez a kupon már nem elérhető' }
  }

  // Insufficient points.
  if (msg.includes('nincs elég pont')) {
    return { status: 400, message: 'Nincs elég pont a beváltáshoz' }
  }

  // Already-used path (defensive — redeem_coupon mints a fresh code so this
  // should not normally fire here, but covers the contract from the spec).
  if (msg.includes('már fel lett használva')) {
    return { status: 409, message: 'Ez a kupon már fel lett használva' }
  }

  // Unique-code generator gave up after 10 retries — treat as transient.
  if (msg.includes('egyedi kuponkódot')) {
    return {
      status: 503,
      message: 'Pillanatnyi hiba a kuponkód generálásakor — próbáld újra',
    }
  }

  // Unknown P0001 — bubble the original message at 400 so the user at least
  // sees the validation reason instead of a generic 500.
  return { status: 400, message: rawMessage }
}
