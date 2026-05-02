"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Coins, X } from "lucide-react";
import type { Coupon } from "@/types/database";
import { formatDiscount } from "@/lib/coupons-api";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Confirmation dialog shown before charging the user's points.
 *
 * The point-shop is real currency in the user's mental model: a deliberate
 * confirmation step (vs. an inline "are you sure?" toast) prevents accidental
 * charges and lets us surface the post-spend balance in advance.
 *
 * Backdrop click + Escape both cancel; the primary CTA is `autoFocus` so
 * keyboard users can confirm with one tap.
 */

interface RedeemConfirmModalProps {
  coupon: Coupon | null;
  /** Caller's current balance — used to preview the post-spend total. */
  userBalance: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RedeemConfirmModal({
  coupon,
  userBalance,
  isSubmitting,
  onCancel,
  onConfirm,
}: RedeemConfirmModalProps) {
  const reduced = useReducedMotion();
  const open = coupon !== null;

  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isSubmitting, onCancel]);

  return (
    <AnimatePresence>
      {open && coupon && (
        <motion.div
          key="redeem-confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="redeem-confirm-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Bezárás"
            onClick={isSubmitting ? undefined : onCancel}
            className="glass-modal-backdrop absolute inset-0 cursor-default"
            tabIndex={-1}
          />

          <motion.div
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }
            }
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn("glass-modal relative w-full max-w-md")}
          >
            {/* Top accent line */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accent-gold) 50%, transparent)",
              }}
            />

            <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <div>
                <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                  Megerősítés
                </p>
                <h2
                  id="redeem-confirm-title"
                  className="mt-1.5 font-display text-2xl tracking-wide text-[var(--text-primary)]"
                >
                  Beváltod a kupont?
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                aria-label="Mégse"
                className={cn(
                  "rounded-full p-1.5 text-[var(--text-muted)]",
                  "transition-colors hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]",
                  "disabled:opacity-50",
                )}
              >
                <X size={16} />
              </button>
            </header>

            <div className="px-6 pb-2">
              <div
                className={cn(
                  "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
                  "bg-[var(--glass-bg)] px-4 py-3.5",
                )}
              >
                <p className="font-display text-sm tracking-wide text-[var(--text-primary)]">
                  {coupon.name}
                </p>
                {coupon.description && (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {coupon.description}
                  </p>
                )}
                <p className="mt-2 font-display text-base tracking-wide text-[var(--accent-gold)]">
                  {formatDiscount(coupon.discount_type, coupon.discount_value)}
                </p>
              </div>

              {/* Balance preview */}
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <dt>Aktuális egyenleg</dt>
                  <dd className="font-display tabular-nums text-[var(--text-primary)]">
                    {userBalance.toLocaleString("hu-HU")} pont
                  </dd>
                </div>
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <dt>Levonás</dt>
                  <dd className="font-display tabular-nums text-[var(--accent-red)]">
                    −{coupon.point_cost.toLocaleString("hu-HU")} pont
                  </dd>
                </div>
                <hr className="border-[var(--glass-border)]" />
                <div className="flex items-center justify-between">
                  <dt className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
                    Beváltás után
                  </dt>
                  <dd className="font-display text-lg tabular-nums tracking-wide text-[var(--accent-gold)]">
                    {(userBalance - coupon.point_cost).toLocaleString("hu-HU")}{" "}
                    pont
                  </dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
                <AlertTriangle
                  size={13}
                  className="mt-0.5 shrink-0 text-[var(--accent-gold)]"
                  aria-hidden
                />
                A beváltás után egyedi kódot generálunk, amelyet a webshop
                vagy jegyvásárlás pénztárában használhatsz fel. A levonás
                végleges.
              </p>
            </div>

            <footer className="flex items-center justify-end gap-3 px-6 py-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="glass-button-secondary"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                autoFocus
                className={cn(
                  "glass-button-primary",
                  isSubmitting && "cursor-not-allowed opacity-70",
                )}
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Beváltás…</span>
                  </>
                ) : (
                  <>
                    <Coins size={14} aria-hidden />
                    <span>
                      Beváltás {coupon.point_cost.toLocaleString("hu-HU")}{" "}
                      pontért
                    </span>
                  </>
                )}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
