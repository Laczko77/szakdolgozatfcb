/**
 * Frontend client for the F13 coupon endpoints.
 *
 * Mirrors the conventions in `lib/shop-api.ts` and `lib/dashboard-api.ts`:
 *   - `cache: "no-store"` so balances/availability are always fresh.
 *   - Throws `Error` (server-provided message when present) on non-2xx.
 *
 * Backend (Iteration 10):
 *   - GET    /api/shop/coupons              → list active coupons
 *   - POST   /api/shop/coupons/[id]/redeem  → spend points, mint code
 *   - GET    /api/profile/coupons           → caller's redeemed coupons
 */

import type { Coupon, DiscountType, RedeemedCoupon } from "@/types/database";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface CouponListResponse {
  coupons: Coupon[];
}

/**
 * The /api/profile/coupons response embeds the coupon definition under
 * `coupon` (the join shape on the backend). Callers need both the redemption
 * (code, is_used, redeemed_at) and the descriptive fields (name, discount_*).
 */
export type RedeemedCouponWithDef = RedeemedCoupon & {
  coupon: Coupon | null;
};

export interface MyCouponsResponse {
  redeemed_coupons: RedeemedCouponWithDef[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* ignore */
  }
  return `${response.status} ${response.statusText}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Active, redeemable coupons sorted by point cost ascending. */
export async function fetchActiveCoupons(
  signal?: AbortSignal,
): Promise<Coupon[]> {
  const data = await getJson<CouponListResponse>("/api/shop/coupons", signal);
  return data.coupons;
}

/**
 * Redeem a coupon: charges `point_cost` from the caller's balance and mints
 * a fresh code. The server returns the new `redeemed_coupons` row.
 */
export async function redeemCoupon(couponId: string): Promise<RedeemedCoupon> {
  const res = await fetch(`/api/shop/coupons/${couponId}/redeem`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as RedeemedCoupon;
}

/**
 * Caller's redeemed coupons. Optional filter:
 *   - `isUsed: true`  → felhasznált
 *   - `isUsed: false` → aktív
 *   - omitted         → mind
 */
export async function fetchMyCoupons(
  options: { isUsed?: boolean; signal?: AbortSignal } = {},
): Promise<RedeemedCouponWithDef[]> {
  const params = new URLSearchParams();
  if (typeof options.isUsed === "boolean") {
    params.set("is_used", options.isUsed ? "true" : "false");
  }
  const qs = params.toString();
  const url = `/api/profile/coupons${qs ? `?${qs}` : ""}`;
  const data = await getJson<MyCouponsResponse>(url, options.signal);
  return data.redeemed_coupons;
}

// ---------------------------------------------------------------------------
// Pure presentation helpers (used by the F13 components)
// ---------------------------------------------------------------------------

/**
 * Human-readable kedvezmény label, e.g. "−15%", "−2 000 Ft", "Ingyen szállítás".
 * Mirrors the formatting style of `lib/format.ts` (Hungarian locale).
 */
const huNumber = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });

export function formatDiscount(
  discountType: Coupon["discount_type"],
  discountValue: number,
): string {
  switch (discountType) {
    case "percentage":
      return `−${huNumber.format(discountValue)}%`;
    case "fixed":
      return `−${huNumber.format(discountValue)} Ft`;
    case "free_shipping":
      return "Ingyen szállítás";
    default:
      return "—";
  }
}

/**
 * Pure client-safe mirror of the server-side `applyDiscount` helper from
 * `lib/coupons.ts`. Duplicated here (instead of imported) because the
 * server module pulls in the service-role Supabase client and would
 * pollute the client bundle.
 *
 * Behaviour MUST stay in lock-step with the server function so the
 * checkout summary's preview matches what `applyCouponToOrder` actually
 * persists. If you change one, change both.
 */
export function previewDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number,
): { final: number; discount: number } {
  let discount = 0;

  if (discountType === "percentage") {
    const pct = Math.min(Math.max(discountValue, 0), 100);
    discount = (subtotal * pct) / 100;
  } else if (discountType === "fixed") {
    discount = Math.max(discountValue, 0);
  } else {
    // free_shipping — no shipping costs in this project.
    discount = 0;
  }

  if (discount > subtotal) discount = subtotal;

  const final = subtotal - discount;
  return {
    final: Number(final.toFixed(2)),
    discount: Number(discount.toFixed(2)),
  };
}
