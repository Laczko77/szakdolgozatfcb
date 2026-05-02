"use client";

import { motion } from "framer-motion";
import { Coins, Lock, Percent, Tag, Truck } from "lucide-react";
import type { Coupon, DiscountType } from "@/types/database";
import { formatDiscount } from "@/lib/coupons-api";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Ticket-style glass card surfacing one redeemable coupon.
 *
 * The visual signature of F13 is the **ticket cut-out**: two semicircular
 * notches on the left/right edges with a dashed perforation line between
 * them, evoking a tear-off voucher. We get the cut-outs with two absolutely
 * positioned circles painted in the page background colour, so the trick
 * is "free" in render terms (no SVG mask).
 *
 * Tone is decided by `discount_type`:
 *   - percentage   → gold (the most common, "headline" discount)
 *   - fixed        → red  (FCB blaugrana red)
 *   - free_shipping→ blue (FCB blue)
 *
 * The redeem CTA is auth-gated by `disabled` (caller decides — usually
 * "not signed in" OR "insufficient balance"). When `disabled` for balance,
 * we surface a hint inline so a hover-only tooltip is not the sole UX.
 */

type Tone = "gold" | "red" | "blue";

const TONE_BY_TYPE: Record<DiscountType, Tone> = {
  percentage: "gold",
  fixed: "red",
  free_shipping: "blue",
};

const TONE_VARS: Record<
  Tone,
  { accent: string; subtle: string; ring: string }
> = {
  gold: {
    accent: "var(--accent-gold)",
    subtle: "var(--accent-gold-subtle)",
    ring: "var(--shadow-glow-gold)",
  },
  red: {
    accent: "var(--accent-red)",
    subtle: "var(--accent-red-subtle)",
    ring: "var(--shadow-glow-red)",
  },
  blue: {
    accent: "var(--accent-blue)",
    subtle: "var(--accent-blue-subtle)",
    ring: "var(--shadow-glow-blue)",
  },
};

const ICON_BY_TYPE: Record<DiscountType, typeof Percent> = {
  percentage: Percent,
  fixed: Tag,
  free_shipping: Truck,
};

interface CouponCardProps {
  coupon: Coupon;
  /** Caller's current balance. When provided we render a "X pont kell még" hint. */
  userBalance?: number;
  /** Caller is not signed in. Disables redeem and changes the CTA copy. */
  isAnonymous?: boolean;
  /** A redeem network call is in flight specifically for this coupon. */
  isRedeeming?: boolean;
  /** Index for staggered reveal — passed by the parent grid. */
  index?: number;
  /** Click handler (kicks off the confirm modal flow at the page level). */
  onRedeem: (coupon: Coupon) => void;
}

export function CouponCard({
  coupon,
  userBalance,
  isAnonymous = false,
  isRedeeming = false,
  index = 0,
  onRedeem,
}: CouponCardProps) {
  const reduced = useReducedMotion();
  const tone = TONE_BY_TYPE[coupon.discount_type];
  const palette = TONE_VARS[tone];
  const Icon = ICON_BY_TYPE[coupon.discount_type];

  const balanceKnown = typeof userBalance === "number";
  const canAfford = !balanceKnown || userBalance >= coupon.point_cost;
  const missing = balanceKnown ? Math.max(coupon.point_cost - userBalance, 0) : 0;

  const disabled = isAnonymous || !canAfford || isRedeeming;

  let hint: string | null = null;
  if (isAnonymous) hint = "Jelentkezz be a beváltáshoz";
  else if (!canAfford) hint = `Még ${missing.toLocaleString("hu-HU")} pont kell`;

  return (
    <motion.article
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.45,
        delay: reduced ? 0 : Math.min(index * 0.06, 0.4),
        ease: "easeOut",
      }}
      className={cn(
        "group relative isolate flex flex-col overflow-hidden",
        "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] backdrop-blur-md",
        "shadow-[var(--shadow-md)]",
        "transition-all duration-300",
        !disabled && "hover:-translate-y-[3px] hover:border-[var(--glass-border-hover)]",
      )}
      style={{
        // Subtle tone wash on the top corner — unique per category without
        // overwhelming the glass.
        backgroundImage: `radial-gradient(120% 80% at 90% 0%, ${palette.subtle}, transparent 65%)`,
      }}
    >
      {/* Top half — discount headline */}
      <div className="relative px-6 pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              "border",
            )}
            style={{
              borderColor: `${palette.accent}55`,
              background: `${palette.accent}1A`,
              color: palette.accent,
            }}
          >
            <Icon size={18} strokeWidth={2.2} aria-hidden />
          </div>

          <span
            className={cn(
              "rounded-full border px-2.5 py-1",
              "font-display text-[10px] uppercase tracking-[0.22em]",
            )}
            style={{
              borderColor: `${palette.accent}40`,
              color: palette.accent,
              background: `${palette.accent}10`,
            }}
          >
            {labelForType(coupon.discount_type)}
          </span>
        </div>

        <p
          className={cn(
            "mt-5 font-display tracking-wider tabular-nums",
            "text-4xl leading-none sm:text-5xl",
          )}
          style={{
            color: palette.accent,
            textShadow: `0 0 28px ${palette.subtle}`,
          }}
        >
          {formatDiscount(coupon.discount_type, coupon.discount_value)}
        </p>

        <h3 className="mt-4 font-display text-xl tracking-wide text-[var(--text-primary)]">
          {coupon.name}
        </h3>
        {coupon.description && (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-3">
            {coupon.description}
          </p>
        )}
      </div>

      {/* Perforation row — semicircle cut-outs + dashed line */}
      <div className="relative h-4">
        {/* Left cut-out */}
        <span
          aria-hidden
          className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
          style={{ background: "var(--bg-primary)" }}
        />
        {/* Right cut-out */}
        <span
          aria-hidden
          className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
          style={{ background: "var(--bg-primary)" }}
        />
        {/* Dashed perforation between the cut-outs */}
        <span
          aria-hidden
          className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--glass-border-hover) 0 6px, transparent 6px 12px)",
          }}
        />
      </div>

      {/* Bottom half — cost + CTA */}
      <div className="flex items-end justify-between gap-3 px-6 pt-4 pb-6">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Pontköltség
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-display text-2xl tracking-wide tabular-nums text-[var(--text-primary)]">
            <Coins size={16} className="text-[var(--accent-gold)]" aria-hidden />
            {coupon.point_cost.toLocaleString("hu-HU")}
          </p>
          {hint && (
            <p
              className={cn(
                "mt-1.5 text-[11px] leading-snug",
                "text-[var(--text-muted)]",
              )}
            >
              {hint}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRedeem(coupon)}
          disabled={disabled}
          aria-label={`${coupon.name} beváltása ${coupon.point_cost} pontért`}
          title={hint ?? undefined}
          className={cn(
            "glass-button-primary whitespace-nowrap",
            disabled && "cursor-not-allowed opacity-60 hover:translate-y-0",
          )}
        >
          {isRedeeming ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Beváltás…</span>
            </>
          ) : !canAfford ? (
            <>
              <Lock size={13} aria-hidden />
              <span>Még nem elérhető</span>
            </>
          ) : (
            <span>Beváltás</span>
          )}
        </button>
      </div>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — shown while /api/shop/coupons is in flight.
// ---------------------------------------------------------------------------

export function CouponCardSkeleton() {
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-[300px] flex-col overflow-hidden",
        "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]",
      )}
    >
      <div className="flex-1 space-y-4 p-6">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-full animate-pulse rounded bg-[var(--glass-bg-hover)]" />
      </div>
      <div className="relative h-4">
        <span
          className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
          style={{ background: "var(--bg-primary)" }}
        />
        <span
          className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
          style={{ background: "var(--bg-primary)" }}
        />
      </div>
      <div className="flex items-end justify-between p-6">
        <div className="h-10 w-24 animate-pulse rounded bg-[var(--glass-bg-hover)]" />
        <div className="h-10 w-28 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function labelForType(t: DiscountType): string {
  switch (t) {
    case "percentage":
      return "Százalékos";
    case "fixed":
      return "Fix összeg";
    case "free_shipping":
      return "Szállítás";
  }
}
