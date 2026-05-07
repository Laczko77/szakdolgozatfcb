/**
 * Pure helpers extracted from `./route.ts` so they can be unit-tested
 * independently of the Next.js request lifecycle. Next.js App Router
 * disallows non-handler exports from route.ts files, hence this sibling
 * `_helpers.ts` file (mirrors the `_validation.ts` pattern used in
 * `src/app/api/dream-team/`).
 */

export type PurchasePayload = {
  match_id: string
  sector_id: string
  quantity: number
  coupon_code: string | null
}

export function parsePurchasePayload(raw: unknown): PurchasePayload | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen kérés tartalom')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.match_id !== 'string' || obj.match_id.trim().length === 0) {
    return new Error('A "match_id" mező kötelező')
  }
  if (typeof obj.sector_id !== 'string' || obj.sector_id.trim().length === 0) {
    return new Error('A "sector_id" mező kötelező')
  }
  if (
    typeof obj.quantity !== 'number' ||
    !Number.isInteger(obj.quantity) ||
    obj.quantity < 1 ||
    obj.quantity > 4
  ) {
    return new Error('A "quantity" 1 és 4 között kell legyen')
  }

  let couponCode: string | null = null
  if (obj.coupon_code !== undefined && obj.coupon_code !== null) {
    if (typeof obj.coupon_code !== 'string') {
      return new Error('A "coupon_code" mezőnek szövegnek kell lennie')
    }
    const trimmed = obj.coupon_code.trim()
    if (trimmed.length > 0) {
      couponCode = trimmed
    }
  }

  return {
    match_id: obj.match_id,
    sector_id: obj.sector_id,
    quantity: obj.quantity,
    coupon_code: couponCode,
  }
}
