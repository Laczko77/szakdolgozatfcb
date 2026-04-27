"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Percent, Tag, Truck } from "lucide-react";
import type { DiscountType } from "@/types/database";
import {
  formatDiscount,
  type RedeemedCouponWithDef,
} from "@/lib/coupons-api";
import { formatDateTime } from "@/lib/format";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Profile-side variant of CouponCard: shows a redeemed coupon (used or
 * unused). Active codes are visually loud; consumed codes are dimmed and
 * marked with a "Felhasználva" badge so the eye sweeps past them.
 *
 * The same ticket-cut visual signature is used as on /pont-aruhaz so the
 * two surfaces feel like halves of one system.
 */

const ICON_BY_TYPE: Record<DiscountType, typeof Percent> = {
  percentage: Percent,
  fixed: Tag,
  free_shipping: Truck,
};

interface RedeemedCouponCardProps {
  redeemed: RedeemedCouponWithDef;
  index?: number;
}

export function RedeemedCouponCard({
  redeemed,
  index = 0,
}: RedeemedCouponCardProps) {
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const coupon = redeemed.coupon;
  // Defensive — backend always joins, but typing forces us to handle null.
  const discountType: DiscountType = coupon?.discount_type ?? "fixed";
  const discountValue = coupon?.discount_value ?? 0;
  const Icon = ICON_BY_TYPE[discountType];
  const isUsed = redeemed.is_used;

  const onCopy = async () => {
    if (isUsed) return;
    try {
      await navigator.clipboard.writeText(redeemed.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard API blocked */
    }
  };

  return (
    <motion.article
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.4,
        delay: reduced ? 0 : Math.min(index * 0.05, 0.3),
        ease: "easeOut",
      }}
      className={cn(
        "relative flex flex-col overflow-hidden",
        "rounded-[var(--radius-lg)] border",
        isUsed
          ? "border-[var(--glass-border)] bg-[var(--glass-bg)] opacity-60 grayscale"
          : "border-[var(--glass-border-hover)] bg-[var(--glass-bg-strong)]",
        "backdrop-blur-md shadow-[var(--shadow-md)]",
        !isUsed && "transition-all duration-300 hover:-translate-y-0.5",
      )}
      style={
        !isUsed
          ? {
              backgroundImage:
                "radial-gradient(120% 80% at 90% 0%, var(--accent-gold-subtle), transparent 65%)",
            }
          : undefined
      }
    >
      {/* "Felhasználva" diagonal stripe */}
      {isUsed && (
        <span
          aria-hidden
          className={cn(
            "absolute right-[-44px] top-5 z-10",
            "rotate-45 select-none px-12 py-1",
            "bg-[var(--accent-red-subtle)] text-[var(--accent-red)]",
            "font-display text-[10px] uppercase tracking-[0.28em]",
            "border-y border-[var(--accent-red)]/40",
          )}
        >
          Felhasználva
        </span>
      )}

      {/* Top — context */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "border border-[var(--accent-gold)]/35",
              isUsed ? "bg-transparent" : "bg-[var(--accent-gold-subtle)]",
              "text-[var(--accent-gold)]",
            )}
          >
            <Icon size={16} strokeWidth={2.2} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base tracking-wide text-[var(--text-primary)] line-clamp-1">
              {coupon?.name ?? "Kupon"}
            </p>
            <p className="font-display text-sm tracking-wide text-[var(--accent-gold)]">
              {formatDiscount(discountType, discountValue)}
            </p>
          </div>
        </div>

        {coupon?.description && (
          <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-2">
            {coupon.description}
          </p>
        )}
      </div>

      {/* Perforation */}
      <div className="relative h-3.5">
        <span
          aria-hidden
          className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
          style={{ background: "var(--bg-primary)" }}
        />
        <span
          aria-hidden
          className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
          style={{ background: "var(--bg-primary)" }}
        />
        <span
          aria-hidden
          className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--glass-border-hover) 0 5px, transparent 5px 10px)",
          }}
        />
      </div>

      {/* Bottom — code + copy */}
      <div className="flex flex-col gap-3 px-5 pt-3.5 pb-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Kód
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {formatDateTime(redeemed.redeemed_at)}
          </p>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border px-3 py-2.5",
            isUsed
              ? "border-[var(--glass-border)] bg-[var(--glass-bg)]"
              : "border-dashed border-[var(--accent-gold)]/40 bg-[var(--accent-gold-subtle)]/30",
          )}
        >
          <code
            className={cn(
              "select-all font-display tabular-nums tracking-[0.18em]",
              "text-sm sm:text-base",
              isUsed
                ? "text-[var(--text-muted)] line-through"
                : "text-[var(--text-primary)]",
            )}
          >
            {redeemed.code}
          </code>
          {!isUsed && (
            <button
              type="button"
              onClick={onCopy}
              aria-label={copied ? "Kód másolva" : "Kód másolása"}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-1",
                "text-[11px] font-display uppercase tracking-[0.18em]",
                "transition-all duration-200",
                copied
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : "border-[var(--glass-border-hover)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {copied ? (
                <>
                  <Check size={11} strokeWidth={2.4} />
                  OK
                </>
              ) : (
                <>
                  <Copy size={11} />
                  Másol
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
