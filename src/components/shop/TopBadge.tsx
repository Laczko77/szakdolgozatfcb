"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Top-3 ribbon shown on the most-viewed products (F28.2).
 *
 * Rank ladder is intentional and visible — TOP 1 wears a stronger gold glow
 * than TOP 2/3 so the leader doesn't disappear into the rest of the podium.
 *
 * The badge is purely decorative; alt-text on the parent <Link> already
 * carries the product name, and the rank itself is announced via
 * aria-label on the badge wrapper for screen readers.
 */

interface TopBadgeProps {
  /** 1, 2, or 3 — index in the global most-viewed leaderboard. */
  rank: 1 | 2 | 3;
  className?: string;
}

const RANK_LABEL: Record<TopBadgeProps["rank"], string> = {
  1: "TOP 1",
  2: "TOP 2",
  3: "TOP 3",
};

export function TopBadge({ rank, className }: TopBadgeProps) {
  const reduceMotion = useReducedMotion();

  // Visual ladder: TOP 1 saturates the gold; 2/3 step it down with opacity.
  const intensityClass =
    rank === 1
      ? "shadow-[0_0_24px_-4px_var(--accent-gold)]"
      : rank === 2
        ? "shadow-[0_0_18px_-6px_var(--accent-gold)] opacity-95"
        : "shadow-[0_0_14px_-8px_var(--accent-gold)] opacity-90";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.6, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 360,
        damping: 22,
        delay: reduceMotion ? 0 : 0.08,
      }}
      role="img"
      aria-label={`${RANK_LABEL[rank]} legnépszerűbb termék`}
      className={cn(
        "pointer-events-none flex items-center gap-1.5 rounded-full",
        "border border-[var(--accent-gold)]/70 backdrop-blur-md",
        // Layered gold gradient on top of the standard glass surface.
        "bg-[linear-gradient(135deg,rgba(196,163,77,0.32),rgba(140,0,56,0.22))]",
        "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        "text-[var(--accent-gold)]",
        intensityClass,
        className,
      )}
    >
      <Trophy size={12} className="-ml-0.5" aria-hidden />
      <span>{RANK_LABEL[rank]}</span>
    </motion.div>
  );
}
