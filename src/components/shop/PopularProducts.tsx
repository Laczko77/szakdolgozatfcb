"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  fetchRecommendedProducts,
  type RecommendedProduct,
} from "@/lib/analytics-api";
import type { ProductWithRating } from "@/lib/shop-api";
import { ProductGrid } from "./ProductGrid";
import { ProductCardSkeleton } from "./ProductCardSkeleton";
import { cn } from "@/lib/utils";

/**
 * "Népszerű termékek" — F14.3 storefront recommendation strip.
 *
 * Rendered above the main listing on `/shop`. Calls
 * /api/products/recommended (a public endpoint backed by the
 * `recommended_products` SQL view that blends view count and average
 * rating into a single score).
 *
 * The section is intentionally self-hiding: if the dataset is too
 * small to be useful (fewer than 3 hits) we render nothing rather
 * than show a half-empty rail. This keeps the page honest while the
 * portal is bootstrapping.
 */

const VISIBLE_COUNT = 4;

export function PopularProducts() {
  const [items, setItems] = useState<RecommendedProduct[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchRecommendedProducts(VISIBLE_COUNT);
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide silently when the section can't add value.
  if (errored) return null;
  if (!isLoading && (items === null || items.length < 3)) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      aria-labelledby="popular-products-heading"
      className="mb-10 sm:mb-14"
    >
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p
            className={cn(
              "font-display text-[11px] uppercase tracking-[0.4em]",
              "text-[var(--accent-gold)]",
            )}
          >
            Trending most
          </p>
          <h2
            id="popular-products-heading"
            className={cn(
              "mt-1 font-display text-2xl leading-none tracking-wider",
              "text-[var(--text-primary)] sm:text-3xl",
            )}
          >
            Népszerű termékek
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            A szurkolók által legtöbbet nézett és legjobban értékelt
            darabok — élő rangsor.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div
          className={cn(
            "grid gap-5 sm:gap-6",
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          )}
          aria-hidden="true"
        >
          {Array.from({ length: VISIBLE_COUNT }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        items && (
          <ProductGrid
            products={items.map(toProduct)}
            ratings={Object.fromEntries(
              items.map((p) => [
                p.product_id,
                { rating: p.avg_rating, count: p.review_count },
              ]),
            )}
          />
        )
      )}
    </motion.section>
  );
}

/**
 * The recommendation API returns a richer shape than the listing API
 * (it joins the view counts), so we project it down to the canonical
 * `Product` shape that {@link ProductGrid} expects.
 */
function toProduct(p: RecommendedProduct): ProductWithRating {
  return {
    id: p.product_id,
    name: p.name,
    description: p.description,
    price: p.price,
    image_url: p.image_url,
    category: p.category,
    created_at: p.created_at,
    // Sale fields aren't part of the recommendation envelope — default
    // them to null so the projection still satisfies the canonical
    // Product shape expected by ProductGrid.
    sale_price: null,
    sale_starts_at: null,
    sale_ends_at: null,
    average_rating: p.avg_rating,
    review_count: p.review_count,
    view_count: p.view_count,
    // Iter25 sale + Iter28 gallery defaults — recommendation envelope
    // doesn't carry these, so we project them to the safe defaults that
    // match a product without an active sale and only its cover image.
    effective_price: p.price,
    is_on_sale: false,
    images: p.image_url
      ? [
          {
            id: `cover:${p.product_id}`,
            image_url: p.image_url,
            display_order: 0,
            is_cover: true,
          },
        ]
      : [],
  };
}
