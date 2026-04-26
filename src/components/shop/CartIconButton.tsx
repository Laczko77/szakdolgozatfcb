"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/providers/CartProvider";
import { cn } from "@/lib/utils";

interface CartIconButtonProps {
  size?: number;
}

/**
 * Pill-shaped cart trigger placed in the navbar.
 *
 * Renders the icon plus a small badge that materialises only when the
 * cart actually has items.  The badge sits in the top-right corner of
 * the button, anchored absolutely so it does not push the icon when the
 * count appears.  Clicking the button opens the global cart drawer via
 * the cart provider.
 */
export function CartIconButton({ size = 18 }: CartIconButtonProps) {
  const { cartCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Kosár (${cartCount} tétel)`}
      title="Kosár"
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        "hover:bg-[var(--glass-bg-hover)] transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
      )}
    >
      <ShoppingBag size={size} strokeWidth={1.75} />
      {cartCount > 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -top-0.5",
            "inline-flex min-w-[18px] items-center justify-center",
            "rounded-full px-1 py-0.5 text-[10px] font-bold leading-none",
            "bg-[var(--accent-red)] text-white",
            "shadow-[var(--shadow-glow-red)]",
            "border border-[var(--bg-primary)]",
          )}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}
