"use client";

import { motion } from "framer-motion";
import { Tag } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * "AKCIÓS" badge shown on products with an active sale window (F29).
 *
 * Lives in the upper-LEFT of the card image well so it never collides with
 * the gold TOP-3 badge (upper-right) or the wishlist heart (relocated to
 * bottom-right when sales are present). The colour ramps off the FCB red
 * accent — strong enough to read on dark photography, quiet enough to
 * sit next to the gold TOP badge without fighting it.
 *
 * Decoration only — the price block and strikethrough already announce the
 * sale to assistive tech. We give the badge an aria-hidden so it doesn't
 * double-up the message.
 */

interface SaleBadgeProps {
  /**
   * Visual size variant. The `lg` variant is used inside the product
   * detail hero where the badge sits beside the heading and needs more
   * presence; the default size matches other card pills.
   */
  size?: "sm" | "lg";
  className?: string;
  /** Optional savings percentage to surface on the badge (e.g. "-25%"). */
  percentOff?: number | null;
}

export function SaleBadge({ size = "sm", className, percentOff }: SaleBadgeProps) {
  const reduced = useReducedMotion();

  const sizeClasses =
    size === "lg"
      ? "px-3 py-1.5 text-[11px]"
      : "px-2.5 py-1 text-[10px]";

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.7, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 24,
      }}
      role="img"
      aria-hidden
      className={cn(
        "pointer-events-none inline-flex items-center gap-1.5 rounded-full",
        "border border-[var(--accent-red)]/70 backdrop-blur-md",
        // Layered red gradient so the badge reads even on bright images.
        "bg-[linear-gradient(135deg,rgba(165,0,68,0.35),rgba(140,0,56,0.55))]",
        "font-semibold uppercase tracking-[0.18em]",
        "text-white shadow-[0_0_18px_-6px_var(--accent-red)]",
        sizeClasses,
        className,
      )}
    >
      <Tag size={size === "lg" ? 13 : 11} strokeWidth={2.4} aria-hidden />
      <span>
        {typeof percentOff === "number" && percentOff > 0
          ? `Akció · -${percentOff}%`
          : "Akciós"}
      </span>
    </motion.div>
  );
}

/**
 * Small helper — given an original and a sale price, return the rounded
 * percentage off (1–99). Returns null when the inputs are invalid or the
 * sale price isn't actually below the original.
 */
export function computePercentOff(
  price: number,
  salePrice: number | null,
): number | null {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(salePrice ?? NaN) ||
    !salePrice ||
    salePrice <= 0 ||
    salePrice >= price
  ) {
    return null;
  }
  const pct = Math.round(((price - salePrice) / price) * 100);
  if (pct <= 0 || pct >= 100) return null;
  return pct;
}
