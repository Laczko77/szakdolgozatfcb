"use client";

import { useMemo } from "react";
import type { ProductWithRating } from "@/lib/shop-api";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: ProductWithRating[];
  /**
   * Optional override map of `productId -> { rating, count }`. The
   * canonical source is the `average_rating` / `review_count` fields the
   * listing endpoint already joins onto each product row, so callers
   * normally don't need this prop. It exists for sub-listings (e.g.
   * "related products") that pre-aggregated the ratings elsewhere.
   */
  ratings?: Record<string, { rating: number; count: number }>;
  /**
   * Globally most-viewed product IDs (max 3, ordered most → least) — from
   * the listing API's `top_products` envelope field (F28). Cards whose
   * IDs appear here render a TOP-1/2/3 badge.
   */
  topProductIds?: string[];
}

export function ProductGrid({
  products,
  ratings,
  topProductIds,
}: ProductGridProps) {
  // Pre-compute the rank map once per render rather than indexOf-ing inside
  // the render loop — listings can reach 50 items per page (MAX_LIMIT).
  const rankById = useMemo(() => {
    const map = new Map<string, 1 | 2 | 3>();
    if (!topProductIds) return map;
    topProductIds.slice(0, 3).forEach((id, idx) => {
      map.set(id, (idx + 1) as 1 | 2 | 3);
    });
    return map;
  }, [topProductIds]);

  return (
    <ul
      className={[
        "grid gap-5 sm:gap-6",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      ].join(" ")}
    >
      {products.map((product, index) => {
        // Override map wins when the caller supplied one (rare path), but
        // the default route is the API-joined fields on the product row.
        const override = ratings?.[product.id];
        const averageRating =
          override?.rating ?? product.average_rating ?? 0;
        const reviewCount = override?.count ?? product.review_count ?? 0;
        const topRank = rankById.get(product.id) ?? null;

        return (
          <ProductCard
            key={product.id}
            product={product}
            averageRating={averageRating}
            reviewCount={reviewCount}
            index={index}
            topRank={topRank}
            viewCount={product.view_count ?? 0}
          />
        );
      })}
    </ul>
  );
}
