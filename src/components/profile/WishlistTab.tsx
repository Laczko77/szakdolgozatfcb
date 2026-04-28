"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * /profil → Kívánságlistám tab (F18.3).
 *
 * Mirrors the standalone `/wishlist` page but lives inside the unified
 * profile shell — so the user finds their hearted products in the same
 * place as orders, tickets and points. The dedicated `/wishlist` route
 * stays as a deep-linkable surface (success screens etc. can link to it
 * directly), but the profile tab is now the discoverable home.
 *
 * Reads from the global `CartProvider` so the heart state stays in sync
 * with the shop pages and the navbar badge.
 */
export function WishlistTab() {
  const { wishlist, isWishlistLoading, removeFromWishlist } = useCart();
  const toast = useToast();
  const reduced = useReducedMotion();

  const handleRemove = async (id: string) => {
    try {
      await removeFromWishlist(id);
      toast.success("Eltávolítva a kívánságlistáról");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Eltávolítás sikertelen",
      );
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────
  if (isWishlistLoading && wishlist.length === 0) {
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            aria-hidden
            className={cn(
              "aspect-[4/5] animate-pulse rounded-[var(--radius-lg)]",
              "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            )}
          />
        ))}
      </ul>
    );
  }

  // ── Empty state ────────────────────────────────────────────────
  if (wishlist.length === 0) {
    return (
      <div
        className={cn(
          "glass-card flex flex-col items-center gap-4",
          "px-6 py-14 text-center",
        )}
      >
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          )}
        >
          <Heart
            size={22}
            strokeWidth={1.6}
            className="text-[var(--accent-red)]"
          />
        </div>
        <p className="font-display text-2xl tracking-wider text-[var(--text-primary)]">
          Még üres a kívánságlistád
        </p>
        <p className="max-w-md text-sm text-[var(--text-secondary)]">
          Nyomj egy szívet bármelyik terméken a shopban, és itt összegyűjtjük
          őket — kéznél lesznek a következő meccs előtti vásárláshoz.
        </p>
        <Link
          href="/shop"
          className="glass-button-secondary mt-2 inline-flex items-center gap-2"
        >
          <ShoppingBag size={14} aria-hidden />
          Tovább a shopba
        </Link>
      </div>
    );
  }

  // ── Populated grid ─────────────────────────────────────────────
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {wishlist.map((row, index) => {
          const product = row.product;
          if (!product) return null;
          return (
            <motion.li
              key={row.id}
              layout
              initial={
                reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{
                duration: 0.32,
                delay: Math.min(index * 0.04, 0.24),
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="group relative"
            >
              <Link
                href={`/shop/${product.id}`}
                className={cn(
                  "glass-card glass-card-hover",
                  "relative flex h-full flex-col overflow-hidden",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                )}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--bg-secondary)]">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-display text-2xl tracking-wider text-[var(--text-muted)] opacity-40">
                        FCB
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleRemove(row.id);
                    }}
                    aria-label="Eltávolítás a kívánságlistáról"
                    className={cn(
                      "absolute right-3 top-3 z-10",
                      "inline-flex h-9 w-9 items-center justify-center rounded-full",
                      "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-md",
                      "text-[var(--accent-red)]",
                      "hover:border-[var(--accent-red)] transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-red)]",
                    )}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  {product.category && (
                    <span className="font-display text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                      {product.category}
                    </span>
                  )}
                  <h3 className="font-display text-lg leading-tight tracking-wide text-[var(--text-primary)]">
                    {product.name}
                  </h3>
                  <span className="mt-auto pt-2 font-display text-xl tracking-wide text-[var(--accent-gold)]">
                    {formatPrice(product.price)}
                  </span>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
