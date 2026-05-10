"use client";

import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Renders a price line that knows about sale state (F29).
 *
 * - When `isOnSale` is true: the effective (sale) price is rendered in
 *   the FCB red accent, with the original price next to it as a faded
 *   `<s>` strikethrough — keeping the original visible is what makes
 *   the saving readable at a glance.
 * - When `isOnSale` is false: only the gold price is rendered, identical
 *   to the pre-F29 baseline so non-sale cards are unchanged.
 *
 * The component is purposefully presentation-only — the caller decides
 * which numbers to feed in. On the listing the API already supplies
 * `effective_price`; on the cart drawer we feed the snapshot price so a
 * sale that expired between add-to-cart and checkout is still honoured.
 */

interface SalePriceBlockProps {
  /** Original (non-sale) catalogue price — always shown when isOnSale. */
  price: number;
  /** Effective price the customer actually pays. */
  effectivePrice: number;
  isOnSale: boolean;
  /** Visual size. `xl` is used on the product detail hero. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Inline (default) wraps both prices on one line; `stacked` puts the
   *  original above the sale price for narrow drawer/checkout contexts. */
  layout?: "inline" | "stacked";
  className?: string;
}

const SIZE_CLASSES: Record<
  NonNullable<SalePriceBlockProps["size"]>,
  { active: string; original: string; gap: string }
> = {
  sm: {
    active: "text-base",
    original: "text-xs",
    gap: "gap-2",
  },
  md: {
    active: "text-xl",
    original: "text-sm",
    gap: "gap-2.5",
  },
  lg: {
    active: "text-2xl",
    original: "text-base",
    gap: "gap-3",
  },
  xl: {
    active: "text-4xl sm:text-5xl",
    original: "text-lg sm:text-xl",
    gap: "gap-3 sm:gap-4",
  },
};

export function SalePriceBlock({
  price,
  effectivePrice,
  isOnSale,
  size = "md",
  layout = "inline",
  className,
}: SalePriceBlockProps) {
  const sz = SIZE_CLASSES[size];

  if (!isOnSale) {
    return (
      <span
        className={cn(
          "font-display tracking-wide text-[var(--accent-gold)]",
          sz.active,
          className,
        )}
      >
        {formatPrice(price)}
      </span>
    );
  }

  const Wrapper = layout === "stacked" ? "div" : "div";

  return (
    <Wrapper
      className={cn(
        "flex font-display tracking-wide",
        layout === "inline"
          ? `flex-wrap items-baseline ${sz.gap}`
          : "flex-col items-start gap-0.5",
        className,
      )}
      aria-label={`Akciós ár: ${formatPrice(effectivePrice)}, eredeti ár: ${formatPrice(price)}`}
    >
      <span
        className={cn(
          "font-bold text-[var(--accent-red)]",
          sz.active,
          // Subtle outer glow so the red reads on dark photography
          // without saturating the rest of the card.
          "drop-shadow-[0_0_12px_rgba(165,0,68,0.35)]",
        )}
      >
        {formatPrice(effectivePrice)}
      </span>
      <s
        className={cn(
          "tracking-wide text-[var(--text-muted)] decoration-[var(--text-muted)]/70",
          "decoration-[1.5px]",
          sz.original,
        )}
      >
        {formatPrice(price)}
      </s>
    </Wrapper>
  );
}
