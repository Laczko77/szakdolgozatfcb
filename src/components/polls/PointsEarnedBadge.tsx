"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PointsEarnedBadgeProps {
  amount?: number;
  className?: string;
}

/**
 * Celebratory badge shown on resolved polls when the caller picked the
 * correct option. The animation is intentionally a single moment — pop
 * in, settle, sit there — rather than looping, so it doesn't pull
 * attention away from the result bars.
 *
 * `prefers-reduced-motion` is honoured globally; the spring still runs
 * but with the duration clipped to ~0ms so the badge appears statically.
 */
export function PointsEarnedBadge({
  amount = 50,
  className,
}: PointsEarnedBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 8 }}
      animate={{
        opacity: 1,
        scale: [0.6, 1.12, 1],
        y: 0,
      }}
      transition={{
        duration: 0.65,
        times: [0, 0.55, 1],
        ease: "easeOut",
        delay: 0.35,
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full",
        "border border-[var(--accent-gold)]/60 bg-[var(--accent-gold)]/15",
        "px-3.5 py-1.5",
        "shadow-[0_0_24px_var(--accent-gold-subtle)]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Sparkles
        size={14}
        className="text-[var(--accent-gold)]"
        aria-hidden
      />
      <span className="font-display text-sm uppercase tracking-[0.18em] text-[var(--accent-gold)] tabular-nums">
        +{amount} pont
      </span>
    </motion.div>
  );
}
