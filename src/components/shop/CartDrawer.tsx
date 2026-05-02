"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, X, Trash2 } from "lucide-react";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./QuantityStepper";

/**
 * Slide-in cart drawer.
 *
 * Layout:
 *   - Desktop (md+): 420px panel anchored to the right edge.
 *   - Mobile:        full-width sheet that takes the entire viewport.
 *
 * The drawer is mounted globally from the layout so any page can summon
 * it via `useCart().openCart()`.  Body scroll is locked while open
 * (handled in the provider so behaviour stays consistent regardless of
 * which trigger opened it).
 */
export function CartDrawer() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();
  const {
    cartItems,
    cartTotal,
    cartCount,
    isCartOpen,
    closeCart,
    updateItem,
    removeItem,
  } = useCart();

  // Close on Escape — accessible drawer convention.
  useEffect(() => {
    if (!isCartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCartOpen, closeCart]);

  const handleQty = async (id: string, next: number) => {
    try {
      await updateItem(id, next);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Mennyiség frissítése sikertelen",
      );
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeItem(id);
      toast.success("Tétel eltávolítva");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Eltávolítás sikertelen",
      );
    }
  };

  const goToCheckout = () => {
    if (!user) {
      closeCart();
      router.push(`/login?returnUrl=${encodeURIComponent("/shop/checkout")}`);
      return;
    }
    closeCart();
    router.push("/shop/checkout");
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={closeCart}
            className="glass-modal-backdrop fixed inset-0 z-[100]"
            aria-hidden
          />

          {/* Drawer panel */}
          <motion.aside
            key="cart-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Bevásárlókosár"
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={{
              duration: reduced ? 0.15 : 0.4,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className={cn(
              "fixed top-0 right-0 bottom-0 z-[110] flex flex-col",
              "w-full md:w-[420px]",
              "bg-[var(--bg-primary)]",
              "border-l border-[var(--glass-border)]",
              "shadow-[var(--shadow-lg)]",
            )}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-[var(--glass-border)] px-5 py-4">
              <div className="flex items-center gap-3">
                <ShoppingBag
                  size={20}
                  className="text-[var(--accent-gold)]"
                  strokeWidth={1.75}
                />
                <h2 className="font-display text-xl tracking-wider text-[var(--text-primary)]">
                  Kosár
                </h2>
                <span className="text-sm text-[var(--text-secondary)]">
                  ({cartCount})
                </span>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Kosár bezárása"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "hover:bg-[var(--glass-bg-hover)] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                )}
              >
                <X size={18} />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartItems.length === 0 ? (
                <EmptyCart onClose={closeCart} />
              ) : (
                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {cartItems.map((item) => {
                      const product = item.variant?.product;
                      const price = product?.price ?? 0;
                      return (
                        <motion.li
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          transition={{ duration: reduced ? 0 : 0.25 }}
                          className={cn(
                            "glass-card flex gap-3 p-3",
                          )}
                        >
                          {/* Thumb */}
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-[var(--bg-secondary)]">
                            {product?.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name ?? ""}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                                <span className="font-display text-sm">FCB</span>
                              </div>
                            )}
                          </div>

                          {/* Body */}
                          <div className="flex flex-1 flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-display text-sm leading-tight tracking-wide text-[var(--text-primary)]">
                                {product?.name ?? "Termék"}
                              </h3>
                              <button
                                type="button"
                                onClick={() => handleRemove(item.id)}
                                aria-label="Tétel eltávolítása"
                                className={cn(
                                  "shrink-0 -mr-1 -mt-1 rounded-full p-1.5",
                                  "text-[var(--text-muted)] hover:text-[var(--accent-red)]",
                                  "transition-colors",
                                )}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <p className="text-xs text-[var(--text-secondary)]">
                              {[item.variant?.size, item.variant?.color]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>

                            <div className="mt-auto flex items-center justify-between pt-1">
                              <QuantityStepper
                                value={item.quantity}
                                onChange={(n) => handleQty(item.id, n)}
                                size="sm"
                                max={item.variant?.stock ?? 99}
                              />
                              <span className="font-display text-base tracking-wide text-[var(--accent-gold)]">
                                {formatPrice(price * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer / summary */}
            {cartItems.length > 0 && (
              <footer
                className={cn(
                  "shrink-0 border-t border-[var(--glass-border)]",
                  "px-5 py-4",
                  "pb-[max(1rem,env(safe-area-inset-bottom))]",
                  "bg-[var(--glass-bg-strong)] backdrop-blur-md",
                )}
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    Összesen
                  </span>
                  <span className="font-display text-2xl tracking-wide text-[var(--accent-gold)]">
                    {formatPrice(cartTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={goToCheckout}
                  className={cn(
                    "glass-button-primary w-full justify-center cta-pulse",
                  )}
                >
                  Pénztár
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
      <div
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        )}
      >
        <ShoppingBag
          size={28}
          className="text-[var(--text-muted)]"
          strokeWidth={1.5}
        />
      </div>
      <p className="font-display text-lg tracking-wider text-[var(--text-primary)]">
        A kosarad üres
      </p>
      <p className="max-w-[20rem] text-sm text-[var(--text-secondary)]">
        Még semmit nem tettél a kosárba. Nézz körül a shopban — biztos találsz
        valamit, amit elvinnél haza.
      </p>
      <Link
        href="/shop"
        onClick={onClose}
        className="glass-button-secondary mt-2"
      >
        Shop böngészése
      </Link>
    </div>
  );
}
