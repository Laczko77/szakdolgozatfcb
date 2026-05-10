"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { motion } from "framer-motion";
import type { Product } from "@/types/database";
import { cn } from "@/lib/utils";
import { isSaleActive } from "@/lib/sale-pricing";
import { RatingStars } from "./RatingStars";
import { WishlistHeart } from "./WishlistHeart";
import { TopBadge } from "./TopBadge";
import { SaleBadge, computePercentOff } from "./SaleBadge";
import { SalePriceBlock } from "./SalePriceBlock";

interface ProductCardProps {
  /**
   * The product row. May optionally carry the API-enriched
   * `effective_price` / `is_on_sale` fields (Iter25 / F29). When absent
   * we fall back to recomputing the sale state from the raw sale_*
   * columns so the card behaves correctly even on legacy callers.
   */
  product: Product & {
    effective_price?: number;
    is_on_sale?: boolean;
  };
  /** Pre-aggregated rating (0–5). 0 means "no reviews yet". */
  averageRating?: number;
  reviewCount?: number;
  /** Used by the parent grid to drive a staggered reveal. */
  index?: number;
  /**
   * Rank inside the global top-3 leaderboard (1–3) — when present, the
   * card renders a TopBadge in the upper-RIGHT of the image well. `null`
   * (the default) means the card is not in the top-3.
   */
  topRank?: 1 | 2 | 3 | null;
  /**
   * Cumulative view count from /api/products. Surfaced on desktop hover
   * as a subtle "X megtekintés" hint. Hidden on touch devices because
   * mobile has no hover.
   */
  viewCount?: number;
}

/**
 * Glass product card used on the storefront listings.
 *
 * Badge layout (F29) — collisions matter, so each corner has a fixed role:
 *   - Top-LEFT     : "AKCIÓS" sale badge (when on sale) OR category pill
 *                    (when present and no sale). Sale takes priority because
 *                    a discount is always more decision-relevant than a tag.
 *   - Top-RIGHT    : TOP-1/2/3 ribbon (when topRank is set).
 *   - Bottom-RIGHT : Wishlist heart — moved out of the top-right so it can
 *                    coexist with the gold TOP badge without overlap.
 *
 * The image area sits on a darker glass surface so jersey photography pops
 * without the card looking flat.  A persistent "Részletek" pill sits at the
 * bottom of the info block so the navigation affordance is always visible —
 * including on touch devices, where the previous hover-only treatment was
 * a no-op.  An actual "Add to cart" CTA is intentionally absent on the
 * listing because variant selection (size/colour) is required before adding
 * to cart, and the listing has no room to host a variant picker without
 * becoming busy.
 */
export function ProductCard({
  product,
  averageRating = 0,
  reviewCount = 0,
  index = 0,
  topRank = null,
  viewCount = 0,
}: ProductCardProps) {
  // Resolve sale state: trust the API envelope when present, otherwise
  // recompute from raw sale_* columns. This keeps the card composable from
  // pages that don't go through /api/products (admin previews, etc.).
  const isOnSale =
    typeof product.is_on_sale === "boolean"
      ? product.is_on_sale
      : isSaleActive(product);
  const effectivePrice =
    typeof product.effective_price === "number"
      ? product.effective_price
      : isOnSale && product.sale_price !== null
        ? Number(product.sale_price)
        : Number(product.price);
  const percentOff = isOnSale
    ? computePercentOff(Number(product.price), product.sale_price)
    : null;

  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.35),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="group relative h-full"
    >
      <Link
        href={`/shop/${product.id}`}
        className={cn(
          "glass-card glass-card-hover",
          "relative flex h-full flex-col overflow-hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        {/* Image well — slightly darker glass so product photos stand out. */}
        <div
          className={cn(
            "relative aspect-[4/5] w-full overflow-hidden",
            "bg-[var(--bg-secondary)]",
          )}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-700 ease-out",
                "group-hover:scale-[1.06]",
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
              <span className="font-display text-2xl tracking-wider opacity-40">
                FCB
              </span>
            </div>
          )}

          {/* Subtle dark gradient at the bottom so the price chip stays
              legible regardless of the image's brightness. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
          />

          {/* Top-LEFT: AKCIÓS badge takes priority over the category pill.
              When there's no active sale we fall back to the category pill
              so categorisation isn't lost. */}
          {isOnSale ? (
            <div className="absolute left-3 top-3 z-10">
              <SaleBadge percentOff={percentOff} />
            </div>
          ) : product.category ? (
            <span
              className={cn(
                "absolute left-3 top-3 z-10",
                "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
                "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-md",
                "text-[var(--text-primary)]",
              )}
            >
              {product.category}
            </span>
          ) : null}

          {/* Top-RIGHT: TOP-3 ribbon. */}
          {topRank !== null && (
            <div className="absolute right-3 top-3 z-10">
              <TopBadge rank={topRank} />
            </div>
          )}

          {/* Bottom-RIGHT: wishlist heart — relocated from the top-right so
              it never collides with the TOP badge. Sits over the bottom
              gradient for legibility. */}
          <div className="absolute bottom-3 right-3 z-10">
            <WishlistHeart productId={product.id} />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
          <h3
            className={cn(
              "font-display text-base leading-tight tracking-wide",
              "text-[var(--text-primary)] line-clamp-2",
            )}
          >
            {product.name}
          </h3>

          <RatingStars value={averageRating} count={reviewCount} />

          {/* View-count hint — desktop hover only. We keep the slot in the
              DOM at all breakpoints so the layout doesn't reflow on hover,
              and rely on opacity + max-height to gate visibility. The
              `(hover: hover)` media query inside the @media wrapper around
              `.glass-card-hover` means this never sticks open on touch. */}
          {viewCount > 0 && (
            <div
              aria-hidden
              className={cn(
                "hidden lg:flex items-center gap-1.5",
                "text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]",
                "opacity-0 transition-opacity duration-300 ease-out",
                "group-hover:opacity-90 group-focus-within:opacity-90",
              )}
            >
              <Eye size={11} aria-hidden />
              <span>{viewCount.toLocaleString("hu-HU")} megtekintés</span>
            </div>
          )}

          <div className="mt-auto space-y-2 pt-2">
            <SalePriceBlock
              price={Number(product.price)}
              effectivePrice={effectivePrice}
              isOnSale={isOnSale}
              size="md"
              layout="inline"
              className="block"
            />
            <div
              className={cn(
                "flex w-full items-center justify-center rounded-full py-1.5",
                "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)]",
                "text-xs font-medium uppercase tracking-wider text-[var(--text-primary)]",
                "transition-colors duration-200",
                "group-hover:border-[var(--accent-gold)] group-hover:text-[var(--accent-gold)]",
              )}
            >
              Részletek
            </div>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}
