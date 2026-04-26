"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trash2 } from "lucide-react";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Wishlist page (/wishlist).
 *
 * Auth-gated through `<ProtectedRoute>` since the wishlist is a per-user
 * resource.  The page reads from the global cart provider so the heart
 * icons everywhere else stay in sync when the user removes an item from
 * here.  No add-to-cart action lives on this page — variant selection
 * is required, so the user must visit the product page to actually add
 * to cart.  We make that obvious with a clear CTA on every card.
 */
export default function WishlistPage() {
  return (
    <ProtectedRoute>
      <WishlistContent />
    </ProtectedRoute>
  );
}

function WishlistContent() {
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

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      <header className="mb-8 sm:mb-10">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-red)]">
          Kívánságlista
        </p>
        <h1 className="mt-2 font-display text-4xl leading-none tracking-wider text-[var(--text-primary)] sm:text-5xl">
          Amit majd elviszel
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          Itt találod a kedvenc termékeidet, amiket később szeretnél megvenni.
          Kattints a termékre, válaszd ki a méretet, és kerüljön a kosaradba!
        </p>
      </header>

      {isWishlistLoading && wishlist.length === 0 ? (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="glass-card aspect-[4/5] animate-pulse"
              aria-hidden
            />
          ))}
        </ul>
      ) : wishlist.length === 0 ? (
        <EmptyWishlist />
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {wishlist.map((row, index) => {
              const product = row.product;
              if (!product) return null;
              return (
                <motion.li
                  key={row.id}
                  layout
                  initial={
                    reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.04, 0.3),
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
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                          <span className="font-display text-2xl tracking-wider opacity-40">
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
                          "absolute right-3 top-3",
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
      )}
    </div>
  );
}

function EmptyWishlist() {
  return (
    <div className="glass-card flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        )}
      >
        <Heart
          size={28}
          className="text-[var(--accent-red)]"
          strokeWidth={1.5}
        />
      </div>
      <p className="font-display text-2xl tracking-wider text-[var(--text-primary)]">
        Még nincs kívánságod
      </p>
      <p className="max-w-md text-sm text-[var(--text-secondary)]">
        Nyomj egy szívet bármelyik terméken a shopban, és itt összegyűjtjük
        őket — így mindig kéznél lesznek, ha a következő meccsre készülsz.
      </p>
      <Link href="/shop" className="glass-button-secondary mt-2">
        Tovább a shopba
      </Link>
    </div>
  );
}
