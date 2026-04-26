"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

interface WishlistHeartProps {
  productId: string;
  /**
   * When true (default), the heart sits inside its own glass pill — used
   * on product cards.  When false the heart is a bare icon button — used
   * on the product detail page next to the "Add to cart" CTA.
   */
  framed?: boolean;
  size?: number;
  className?: string;
}

/**
 * Animated wishlist toggle.
 *
 * Animation reasoning:
 *   - Pure CSS keyframes (no JS lib) — the burst is small and unrelated to
 *     React state, which keeps it cheap on cards rendered en masse.
 *   - We replay the keyframe on every "fill" by remounting via a key — using
 *     `animation: none → animation: pop` would otherwise stutter on the
 *     second click.
 */
export function WishlistHeart({
  productId,
  framed = true,
  size = 18,
  className,
}: WishlistHeartProps) {
  const { user } = useAuth();
  const { isOnWishlist, toggleWishlist } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [pulseKey, setPulseKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const active = isOnWishlist(productId);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.info("Jelentkezz be a kívánságlistához");
      router.push(
        `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      await toggleWishlist(productId);
      if (!active) setPulseKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Sikertelen művelet",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={
        active ? "Eltávolítás a kívánságlistáról" : "Hozzáadás a kívánságlistához"
      }
      className={cn(
        framed && [
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-md",
          "shadow-[var(--shadow-sm)]",
          "transition-colors duration-200",
          "hover:border-[var(--accent-red)]",
        ],
        !framed && [
          "inline-flex h-11 w-11 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "transition-colors duration-200",
          "hover:border-[var(--accent-red)]",
        ],
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-red)]",
        "disabled:opacity-60",
        className,
      )}
      disabled={busy}
    >
      <span
        key={pulseKey}
        className={cn(
          "relative inline-flex",
          active && "wishlist-pop",
        )}
      >
        <Heart
          size={size}
          strokeWidth={active ? 0 : 1.75}
          className={cn(
            "transition-colors duration-200",
            active
              ? "fill-[var(--accent-red)] text-[var(--accent-red)]"
              : "text-[var(--text-secondary)]",
          )}
        />
      </span>

      {/* CSS keyframes for the pop animation — colocated so the component
          is fully self-contained and theme-agnostic. */}
      <style jsx>{`
        .wishlist-pop {
          animation: wishlist-burst 460ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes wishlist-burst {
          0% {
            transform: scale(0.8);
          }
          40% {
            transform: scale(1.35);
          }
          70% {
            transform: scale(0.92);
          }
          100% {
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .wishlist-pop {
            animation: none;
          }
        }
      `}</style>
    </button>
  );
}
