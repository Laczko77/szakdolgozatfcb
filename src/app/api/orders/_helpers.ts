/**
 * Pure helpers extracted from `./route.ts` so they can be unit-tested
 * independently of the Next.js request lifecycle. Next.js App Router
 * disallows non-handler exports from route.ts files, hence this sibling
 * `_helpers.ts` file (mirrors the `_validation.ts` pattern used in
 * `src/app/api/dream-team/`).
 */

import type { ShippingAddress } from '@/types/database'

export function parseOptionalCouponCode(raw: unknown): string | null | Error {
  if (typeof raw !== 'object' || raw === null) {
    // Same error path as parseShippingAddress; still return Error to be safe.
    return new Error('Érvénytelen kérés tartalom')
  }
  const obj = raw as Record<string, unknown>
  if (obj.coupon_code === undefined || obj.coupon_code === null) {
    return null
  }
  if (typeof obj.coupon_code !== 'string') {
    return new Error('A "coupon_code" mezőnek szövegnek kell lennie')
  }
  const trimmed = obj.coupon_code.trim()
  if (trimmed.length === 0) return null
  return trimmed
}

export function parseShippingAddress(raw: unknown): ShippingAddress | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen kérés tartalom')
  }
  const candidate = raw as Record<string, unknown>
  const addr = candidate.shipping_address
  if (typeof addr !== 'object' || addr === null) {
    return new Error('A "shipping_address" mező kötelező')
  }
  const a = addr as Record<string, unknown>
  const required: (keyof ShippingAddress)[] = [
    'full_name',
    'country',
    'city',
    'postal_code',
    'street',
  ]
  for (const key of required) {
    if (typeof a[key] !== 'string' || (a[key] as string).trim().length === 0) {
      return new Error(`Hiányzó "${key}" mező a szállítási címben`)
    }
  }
  const out: ShippingAddress = {
    full_name: (a.full_name as string).trim(),
    country: (a.country as string).trim(),
    city: (a.city as string).trim(),
    postal_code: (a.postal_code as string).trim(),
    street: (a.street as string).trim(),
  }
  if (typeof a.phone === 'string' && a.phone.trim().length > 0) {
    out.phone = a.phone.trim()
  }
  return out
}
