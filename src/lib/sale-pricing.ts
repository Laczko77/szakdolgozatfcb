/**
 * Sale-pricing helpers (Iter25).
 *
 * Centralises the rule for whether a product is currently on sale and what
 * its effective unit price is. Callers in API routes use this to enrich
 * outgoing payloads with `effective_price` and `is_on_sale`. The same rule
 * is mirrored in SQL inside the `recommended_products` view and the cart
 * POST endpoint, which snapshots the effective price at add-to-cart time.
 *
 * Rules:
 *   - A sale is active iff `sale_price IS NOT NULL` AND
 *       (`sale_starts_at IS NULL` OR now >= sale_starts_at) AND
 *       (`sale_ends_at`   IS NULL OR now <  sale_ends_at).
 *   - When inactive, `effective_price === price`.
 *   - When the rule changes, update both this file AND the SQL view above
 *     so the public API stays consistent with `/recommended`.
 */

import type { Product } from '@/types/database'

export type SalePricingFields = Pick<
  Product,
  'price' | 'sale_price' | 'sale_starts_at' | 'sale_ends_at'
>

export type SalePricingResult = {
  effective_price: number
  is_on_sale: boolean
}

/**
 * Compute the effective price and `is_on_sale` flag for a product row.
 * `now` is injectable for deterministic tests; defaults to the current time.
 */
export function computeSalePricing(
  product: SalePricingFields,
  now: Date = new Date()
): SalePricingResult {
  if (!isSaleActive(product, now)) {
    return { effective_price: Number(product.price), is_on_sale: false }
  }
  return {
    effective_price: Number(product.sale_price as number),
    is_on_sale: true,
  }
}

/**
 * Whether the product's sale window covers `now`. Returns false when
 * `sale_price` is NULL — i.e. the product simply has no sale configured.
 */
export function isSaleActive(
  product: SalePricingFields,
  now: Date = new Date()
): boolean {
  if (product.sale_price === null || product.sale_price === undefined) {
    return false
  }
  const t = now.getTime()
  if (product.sale_starts_at !== null) {
    if (t < new Date(product.sale_starts_at).getTime()) return false
  }
  if (product.sale_ends_at !== null) {
    if (t >= new Date(product.sale_ends_at).getTime()) return false
  }
  return true
}
