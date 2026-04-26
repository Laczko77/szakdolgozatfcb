"use client";

import type { Product } from "@/types/database";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  /** Map of productId -> { rating, count } for sub-listings that already
   *  joined the aggregate.  Optional — listing endpoint doesn't include
   *  ratings to avoid an extra round trip per page. */
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
        const r = ratings?.[product.id];
        return (
          <ProductCard
            key={product.id}
            product={product}
            averageRating={r?.rating ?? 0}
            reviewCount={r?.count ?? 0}
            index={index}
          />
        );
      })}
    </ul>
  );
}
