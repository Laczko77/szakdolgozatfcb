"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Flame } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Real-time sale countdown (F29.3).
 *
 * Re-computes the remaining duration once per second from a single
 * `setInterval`. When the deadline passes we:
 *   1) emit `onExpire` so the parent can refetch the product (the server
 *      will then serve `is_on_sale = false` and the component unmounts).
 *   2) render a final "Lejárt" frame for the brief window before the
 *      refetch lands, instead of flickering to a negative value.
 *
 * Layout:
 *   - Desktop: full row "X nap Y óra Z perc W mp" with labels.
 *   - Mobile (<sm): compact "X nap Y óra" (perc + mp dropped) so the row
 *     never wraps awkwardly under the price block.
 */

interface SaleCountdownProps {
  /** ISO datetime string when the sale ends. */
  endsAt: string;
  /**
   * Called once when the countdown reaches zero. The parent uses this to
   * refetch the product so the UI flips back to the regular price.
   */
  onExpire?: () => void;
  className?: string;
}

interface Remaining {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function compute(endsAtMs: number, now: number): Remaining {
  const diff = endsAtMs - now;
  if (diff <= 0) {
    return {
      total: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    };
  }
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return { total: diff, days, hours, minutes, seconds, expired: false };
}

export function SaleCountdown({ endsAt, onExpire, className }: SaleCountdownProps) {
  const reduced = useReducedMotion();
  const endsAtMs = new Date(endsAt).getTime();
  const [remaining, setRemaining] = useState<Remaining>(() =>
    compute(endsAtMs, Date.now()),
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    // Reset expiry latch when a fresh deadline arrives (e.g. admin
    // extended the sale and the page re-mounted us with a new prop).
    expiredRef.current = false;
    // queueMicrotask defers the initial setState out of the effect body
    // (react-hooks/set-state-in-effect lint rule under React 19 +
    // eslint-config-next).
    queueMicrotask(() => {
      setRemaining(compute(endsAtMs, Date.now()));
    });

    if (Number.isNaN(endsAtMs)) return;

    const tick = () => {
      const next = compute(endsAtMs, Date.now());
      setRemaining(next);
      if (next.expired && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAtMs, onExpire]);

  if (Number.isNaN(endsAtMs)) return null;

  // Once expired we render a brief "Lejárt" placeholder. The parent's
  // refetch will replace us with the regular price within ~one tick.
  if (remaining.expired) {
    return (
      <div
        className={cn(
          "glass-card flex items-center gap-2.5 px-4 py-2.5",
          "border-[var(--accent-red)]/30",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <Clock size={14} className="text-[var(--text-muted)]" aria-hidden />
        <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Az akció lejárt
        </span>
      </div>
    );
  }

  // Urgency tier — drives accent strength as the deadline approaches.
  // < 1 hour:   strong red glow, pulsing flame icon
  // < 24 hours: amber/red blend
  // otherwise:  amber accent
  const lessThanHour = remaining.total < 60 * 60 * 1000;
  const lessThanDay = remaining.total < 24 * 60 * 60 * 1000;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="status"
      aria-live="polite"
      aria-label={a11yLabel(remaining)}
      className={cn(
        "glass-card relative overflow-hidden",
        "px-4 py-3 sm:px-5 sm:py-3.5",
        "border-[var(--accent-red)]/40",
        // Subtle red-to-orange wash so the card feels warmer than the
        // baseline glass without overwhelming the page.
        "bg-[linear-gradient(135deg,rgba(165,0,68,0.10),rgba(255,138,0,0.08))]",
        lessThanHour && "shadow-[0_0_22px_-6px_var(--accent-red)]",
        className,
      )}
    >
      {/* Decorative scan-line — drifts across the card on a slow loop so
          the countdown feels alive without being noisy. CSS animation
          (no JS), automatically frozen by prefers-reduced-motion. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 -inset-x-4",
          "bg-[linear-gradient(110deg,transparent_45%,rgba(255,255,255,0.06)_50%,transparent_55%)]",
          "animate-[shimmer_4.5s_linear_infinite]",
          "motion-reduce:hidden",
        )}
      />

      <div className="relative flex items-center gap-3">
        {/* Icon block */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            "border",
            lessThanHour
              ? "border-[var(--accent-red)]/60 bg-[var(--accent-red)]/15 text-[var(--accent-red)]"
              : "border-[var(--accent-gold)]/50 bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]",
          )}
          aria-hidden
        >
          {lessThanHour ? (
            <Flame
              size={16}
              strokeWidth={2}
              className={cn(!reduced && "animate-pulse")}
            />
          ) : (
            <Clock size={16} strokeWidth={1.8} />
          )}
        </div>

        {/* Text + numbers */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p
            className={cn(
              "font-display text-[10px] uppercase tracking-[0.22em]",
              lessThanHour
                ? "text-[var(--accent-red)]"
                : "text-[var(--accent-gold)]",
            )}
          >
            {lessThanHour
              ? "Az akció hamarosan véget ér"
              : lessThanDay
                ? "Utolsó nap"
                : "Az akció hátralévő ideje"}
          </p>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <CountdownUnit value={remaining.days} label="nap" alwaysVisible />
            <CountdownUnit value={remaining.hours} label="óra" alwaysVisible />
            <CountdownUnit
              value={remaining.minutes}
              label="perc"
              compactHidden
            />
            <CountdownUnit
              value={remaining.seconds}
              label="mp"
              compactHidden
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CountdownUnit({
  value,
  label,
  alwaysVisible = false,
  compactHidden = false,
}: {
  value: number;
  label: string;
  alwaysVisible?: boolean;
  /** When true the unit is hidden under sm (mobile compact mode). */
  compactHidden?: boolean;
}) {
  const padded = String(Math.max(0, value)).padStart(2, "0");
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1",
        compactHidden && "hidden sm:inline-flex",
        !alwaysVisible && "sm:inline-flex",
      )}
    >
      <span className="font-display text-lg font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
        {padded}
      </span>
      <span className="font-display text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
        {label}
      </span>
    </span>
  );
}

function a11yLabel(r: Remaining): string {
  return `Az akció ${r.days} nap ${r.hours} óra ${r.minutes} perc ${r.seconds} másodperc múlva ér véget`;
}
