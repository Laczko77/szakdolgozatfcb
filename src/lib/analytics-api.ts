/**
 * Frontend client for the F14 / Backend Iteration 11 endpoints:
 *
 *   POST /api/consent              — record a GDPR decision (returns cookie_id)
 *   POST /api/tracking/pageview    — log a page view (silent 204 if no consent)
 *   GET  /api/products/recommended — ranked, public-facing product list
 *
 * The pageview call is fire-and-forget: we never block navigation on its
 * outcome and only log unexpected failures to the console. Consent and
 * recommended endpoints follow the standard `{ data: ... }` envelope used
 * across the rest of the app, so we unwrap them the same way.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentResponse {
  cookie_id: string;
  consented: boolean;
  created_at: string;
}

export interface RecommendedProduct {
  product_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  category: string | null;
  created_at: string;
  view_count: number;
  avg_rating: number;
  review_count: number;
  score: number;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text.length === 0 ? null : JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const msg =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
        ? ((parsed as { error: string }).error)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return parsed as T;
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * Record a consent decision on the backend. The server mints (or
 * upserts) a UUID `cookie_id` we then persist client-side.
 */
export async function postConsent(
  consented: boolean,
  cookieId?: string,
): Promise<ConsentResponse> {
  const res = await fetch("/api/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      cookieId ? { consented, cookie_id: cookieId } : { consented },
    ),
  });
  const payload = await parseJson<{ data: ConsentResponse }>(res);
  return payload.data;
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

/**
 * Fire a single page-view ping. The backend silently drops the event
 * (HTTP 204) when consent is missing or declined, so the frontend does
 * not need to gate the call beyond having a `cookie_id` available.
 *
 * Errors are swallowed — a failed analytics ping must never break the
 * user's navigation.
 */
export async function postPageView(params: {
  cookieId: string;
  pagePath: string;
  productId?: string | null;
}): Promise<void> {
  try {
    await fetch("/api/tracking/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cookie_id: params.cookieId,
        page_path: params.pagePath,
        ...(params.productId ? { product_id: params.productId } : {}),
      }),
      // `keepalive` lets the request finish even if the user navigates
      // away mid-flight (Safari caps these at 64 KB which is fine here).
      keepalive: true,
    });
  } catch (err) {
    console.warn("[analytics] pageview ping failed", err);
  }
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

/**
 * Public ranked list of "popular" products, blended from view count and
 * average review rating. Used by the storefront and dashboard to
 * surface data-driven recommendations.
 */
export async function fetchRecommendedProducts(
  limit = 6,
): Promise<RecommendedProduct[]> {
  const res = await fetch(`/api/products/recommended?limit=${limit}`, {
    // The view aggregates daily-ish data — hourly cache is a sane
    // ceiling that keeps the homepage snappy without staleness anxiety.
    next: { revalidate: 600 },
  });
  const payload = await parseJson<{ products: RecommendedProduct[] }>(res);
  return payload.products ?? [];
}
