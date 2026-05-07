"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Product } from "@/types/database";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RatingStars } from "./RatingStars";
import { WishlistHeart } from "./WishlistHeart";

interface ProductCardProps {
  product: Product;
  /** Pre-aggregated rating (0–5). 0 means "no reviews yet". */
  averageRating?: number;
  reviewCount?: number;
  /** Used by the parent grid to drive a staggered reveal. */
  index?: number;
}

/**
 * Glass product card used on the storefront listings.
 *
 * The image area sits on a darker glass surface so jersey photography pops
 * without the card looking flat.  A persistent "Részletek" (View) pill
 * sits at the bottom of the info block so the navigation affordance is
 * always visible — including on touch devices, where the previous
 * hover-only treatment was a no-op.  An actual "Add to cart" CTA is
 * intentionally absent on the listing because variant selection
 * (size/colour) is required before adding to cart, and the listing has
 * no room to host a variant picker without becoming busy.
 */
export function ProductCard({
  product,
  averageRating = 0,
  reviewCount = 0,
  index = 0,
}: ProductCardProps) {
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

          {/* Wishlist heart — top right corner */}
          <div className="absolute right-3 top-3 z-10">
            <WishlistHeart productId={product.id} />
          </div>

          {/* Category pill — top left, only when there's a category */}
          {product.category && (
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
          )}

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

          <div className="mt-auto space-y-2 pt-2">
            <span className="block font-display text-xl tracking-wide text-[var(--accent-gold)]">
              {formatPrice(product.price)}
            </span>
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
