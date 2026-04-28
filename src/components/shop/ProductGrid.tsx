"use client";

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
}

export function ProductGrid({ products, ratings }: ProductGridProps) {
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

        return (
          <ProductCard
            key={product.id}
            product={product}
            averageRating={averageRating}
            reviewCount={reviewCount}
            index={index}
          />
        );
      })}
    </ul>
  );
}
