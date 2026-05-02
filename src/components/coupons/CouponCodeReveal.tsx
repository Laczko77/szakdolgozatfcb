"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Copy, PartyPopper, Ticket, X } from "lucide-react";
import type { Coupon, RedeemedCoupon } from "@/types/database";
import { formatDiscount } from "@/lib/coupons-api";
import { SuccessConfetti } from "@/components/shop/SuccessConfetti";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Post-redeem celebration: surface the freshly minted coupon code,
 * one-click copy to clipboard, and a primary CTA into /kuponjaim.
 *
 * Mounts once a redeem succeeds (controlled by the page-level state).
 * The CSS confetti from the F8 success page is reused here — it is
 * already deterministic, SSR-safe and `prefers-reduced-motion` aware.
 */

interface CouponCodeRevealProps {
  redeemed: RedeemedCoupon | null;
  /** The coupon definition that was redeemed (for context in the dialog). */
  coupon: Coupon | null;
  onClose: () => void;
}

export function CouponCodeReveal({
  redeemed,
  coupon,
  onClose,
}: CouponCodeRevealProps) {
  const reduced = useReducedMotion();
  const open = redeemed !== null;
  const [copied, setCopied] = useState(false);

  // Reset copy state when a fresh code is revealed.
  // Deferred via microtask so the setState is not synchronous in the effect
  // body (see memory: feedback_setstate_in_effect).
  useEffect(() => {
    if (open) queueMicrotask(() => setCopied(false));
  }, [open, redeemed?.id]);

  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const onCopy = async () => {
    if (!redeemed) return;
    try {
      await navigator.clipboard.writeText(redeemed.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard API blocked — leave the visual state untouched */
    }
  };

  return (
    <AnimatePresence>
      {open && redeemed && (
        <motion.div
          key="code-reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="code-reveal-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Bezárás"
            onClick={onClose}
            className="glass-modal-backdrop absolute inset-0 cursor-default"
            tabIndex={-1}
          />

          {/* Confetti wrapped in its own absolute layer so it does not affect
              the dialog's hit-testing. */}
          <div className="pointer-events-none absolute inset-0">
            <SuccessConfetti count={36} />
          </div>

          <motion.div
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: 30, scale: 0.94 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: 12, scale: 0.96 }
            }
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 22,
              mass: 0.9,
            }}
            className={cn(
              "glass-modal relative w-full max-w-md overflow-hidden",
            )}
          >
            {/* Top gold sheen */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accent-gold), transparent)",
              }}
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Bezárás"
              className={cn(
                "absolute right-4 top-4 rounded-full p-1.5",
                "text-[var(--text-muted)] transition-colors",
                "hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]",
              )}
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center gap-2 px-6 pt-9 pb-2 text-center">
              <motion.span
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.5, rotate: -10 }
                }
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.05,
                  type: "spring",
                  stiffness: 300,
                  damping: 18,
                }}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full",
                  "border border-[var(--accent-gold)]/40",
                  "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)]",
                  "shadow-[var(--shadow-glow-gold)]",
                )}
              >
                <PartyPopper size={26} strokeWidth={2.2} aria-hidden />
              </motion.span>

              <p className="mt-2 font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                Sikeres beváltás
              </p>
              <h2
                id="code-reveal-title"
                className="font-display text-3xl leading-none tracking-wide text-[var(--text-primary)]"
              >
                Kupon a tiéd!
              </h2>
              {coupon && (
                <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">
                    {coupon.name}
                  </span>{" "}
                  ·{" "}
                  <span className="text-[var(--accent-gold)]">
                    {formatDiscount(
                      coupon.discount_type,
                      coupon.discount_value,
                    )}
                  </span>
                </p>
              )}
            </div>

            {/* Code block — copy button overlays the right side */}
            <div className="px-6 pt-5 pb-2">
              <p className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Kuponkód
              </p>
              <div
                className={cn(
                  "mt-2 flex items-center gap-3 overflow-hidden",
                  "rounded-[var(--radius-md)] border-2 border-dashed",
                  "border-[var(--accent-gold)]/45 bg-[var(--accent-gold-subtle)]/40",
                  "px-4 py-4",
                )}
              >
                <Ticket
                  size={18}
                  className="shrink-0 text-[var(--accent-gold)]"
                  aria-hidden
                />
                <code
                  className={cn(
                    "flex-1 select-all font-display tabular-nums",
                    "text-xl tracking-[0.2em] text-[var(--text-primary)]",
                  )}
                >
                  {redeemed.code}
                </code>
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label={copied ? "Kód másolva" : "Kód másolása"}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-3 py-1.5",
                    "border text-xs font-display uppercase tracking-[0.2em]",
                    "transition-all duration-200",
                    copied
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-[var(--glass-border-hover)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {copied ? (
                    <>
                      <Check size={13} strokeWidth={2.4} />
                      Másolva
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      Másol
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Add meg ezt a kódot a webshop pénztárában a kedvezmény
                érvényesítéséhez. A kód egyszer használható fel.
              </p>
            </div>

            <footer className="flex flex-col gap-2 px-6 pt-4 pb-6 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="glass-button-secondary"
              >
                Bezárás
              </button>
              <Link
                href="/kuponjaim"
                onClick={onClose}
                className="glass-button-primary"
              >
                <span>Kuponjaim</span>
                <ArrowRight size={14} aria-hidden />
              </Link>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
