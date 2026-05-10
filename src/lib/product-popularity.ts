import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Iter24 — shared helpers for product popularity aggregation.
 *
 * Backed by the SECURITY DEFINER RPC `get_product_view_counts()` (see
 * migration 022) which exposes a `(product_id, view_count)` aggregate to
 * anon + authenticated callers without leaking raw `page_views` rows.
 *
 * The top-3 product IDs are cached in-process for `TOP_PRODUCTS_TTL_MS` to
 * avoid re-aggregating on every product list request. Time-based eviction is
 * sufficient — popularity drifts slowly, and serverless instances rotate
 * frequently enough that stale data is naturally bounded.
 */

const TOP_PRODUCTS_TTL_MS = 5 * 60 * 1000 // 5 minutes
const TOP_N = 3

export type ViewCountRow = {
  product_id: string
  view_count: number
}

type TopCache = {
  ids: string[]
  expiresAt: number
}

let topCache: TopCache | null = null

/**
 * Fetch the full `(product_id, view_count)` aggregate from Postgres.
 * Returns an empty array on RPC failure — popularity is non-critical for
 * page rendering, so we degrade gracefully rather than 500 the product list.
 */
export async function fetchProductViewCounts(
  supabase: SupabaseClient
): Promise<ViewCountRow[]> {
  const { data, error } = await supabase.rpc('get_product_view_counts')
  if (error || !data) return []
  return data as ViewCountRow[]
}

/**
 * Build a quick `product_id -> view_count` lookup map.
 */
export function viewCountMap(rows: ViewCountRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.product_id, row.view_count)
  }
  return map
}

/**
 * Top-N most-viewed product IDs, ordered by view_count desc. Reads from the
 * in-process cache when warm; otherwise queries the RPC and warms the cache.
 *
 * If `precomputed` is supplied, it is used as the source-of-truth and the
 * cache is refreshed from it (this avoids a redundant RPC round-trip when
 * the caller already has the full aggregate in hand).
 */
export async function getTopProductIds(
  supabase: SupabaseClient,
  precomputed?: ViewCountRow[]
): Promise<string[]> {
  const now = Date.now()

  if (precomputed) {
    const ids = topNIds(precomputed)
    topCache = { ids, expiresAt: now + TOP_PRODUCTS_TTL_MS }
    return ids
  }

  if (topCache && topCache.expiresAt > now) {
    return topCache.ids
  }

  const rows = await fetchProductViewCounts(supabase)
  const ids = topNIds(rows)
  topCache = { ids, expiresAt: now + TOP_PRODUCTS_TTL_MS }
  return ids
}

function topNIds(rows: ViewCountRow[]): string[] {
  return [...rows]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, TOP_N)
    .map((r) => r.product_id)
}
