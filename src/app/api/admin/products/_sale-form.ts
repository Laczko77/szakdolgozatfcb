/**
 * Shared parsing + validation for the sale-pricing form fields used by
 * `POST /api/admin/products` and `PUT /api/admin/products/[id]`.
 *
 * Three multipart/form-data fields:
 *   - `sale_price`      numeric, > 0 and < `price` when present
 *   - `sale_starts_at`  ISO datetime, optional even when sale_price is set
 *   - `sale_ends_at`    ISO datetime, must be after sale_starts_at when both
 *                       are present
 *
 * Semantics
 * ---------
 *   - To CLEAR a sale on update, send `sale_price` (and optionally the dates)
 *     as the literal string `null` or empty string. The parser returns `null`
 *     for those fields, which the route translates into `update.sale_*  = null`.
 *   - On create (POST), missing fields are treated as "no sale" — all three
 *     stay NULL.
 *
 * The DB CHECK constraints (`products_sale_price_below_price_chk`,
 * `products_sale_window_chk`) are the ultimate source of truth — these
 * helpers just surface the violation as a 400 with a localised message
 * before the round-trip.
 */

export type SaleFormFields = {
  // undefined = field absent (no change on PUT, no value on POST).
  // null      = explicit clear (admin removed the sale on PUT).
  // number/string = parsed value.
  sale_price: number | null | undefined
  sale_starts_at: string | null | undefined
  sale_ends_at: string | null | undefined
}

export function readSaleFields(form: FormData): SaleFormFields {
  return {
    sale_price: parseNullableNumber(form.get('sale_price')),
    sale_starts_at: parseNullableDate(form.get('sale_starts_at')),
    sale_ends_at: parseNullableDate(form.get('sale_ends_at')),
  }
}

/**
 * Validate the sale fields against `price` and against each other.
 * Returns null on success or a localised Hungarian error on failure.
 */
export function validateSaleFields(
  fields: SaleFormFields,
  price: number
): string | null {
  if (fields.sale_price === undefined || fields.sale_price === null) {
    // No sale price (or being cleared) — nothing else to validate.
    return null
  }
  if (!Number.isFinite(fields.sale_price) || fields.sale_price <= 0) {
    return 'Az akciós ár pozitív szám kell legyen'
  }
  if (fields.sale_price >= price) {
    return 'Az akciós árnak kisebbnek kell lennie az alapárnál'
  }

  const start =
    typeof fields.sale_starts_at === 'string'
      ? new Date(fields.sale_starts_at).getTime()
      : null
  const end =
    typeof fields.sale_ends_at === 'string'
      ? new Date(fields.sale_ends_at).getTime()
      : null

  if (start !== null && Number.isNaN(start)) {
    return 'Érvénytelen "sale_starts_at" érték'
  }
  if (end !== null && Number.isNaN(end)) {
    return 'Érvénytelen "sale_ends_at" érték'
  }
  if (start !== null && end !== null && start >= end) {
    return 'Az akció kezdete a vége előtt kell legyen'
  }

  return null
}

/**
 * If sale_price is being cleared (null), force the date fields to null too.
 * Mirrors the "delete sale endpoint" semantics so partial clears can't leave
 * orphan timestamps behind.
 */
export function normalizeClearedSale(fields: SaleFormFields): SaleFormFields {
  if (fields.sale_price === null) {
    return {
      sale_price: null,
      sale_starts_at: null,
      sale_ends_at: null,
    }
  }
  return fields
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseNullableNumber(
  raw: FormDataEntryValue | null
): number | null | undefined {
  if (raw === null) return undefined
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : NaN // NaN → caught by validator
}

function parseNullableDate(
  raw: FormDataEntryValue | null
): string | null | undefined {
  if (raw === null) return undefined
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return null
  // Don't reject here — let validateSaleFields normalise via Date.parse so
  // we have one consistent error message path.
  return trimmed
}
