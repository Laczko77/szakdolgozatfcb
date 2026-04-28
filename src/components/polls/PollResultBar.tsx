"use client";

import { motion } from "framer-motion";
import { Check, Crown, HelpCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PollResultBarProps {
  /** Display label (option text). */
  label: string;
  /** Raw vote count for this option. */
  votes: number;
  /** Sum of all votes — used to compute the percentage. */
  totalVotes: number;
  /** True if this option is the user's own vote. */
  isUserVote: boolean;
  /** True if this option is the resolved-correct answer. */
  isCorrect: boolean;
  /** Drives the staggered bar fill animation. */
  index: number;
  /**
   * Iter17: marks the special "Más / Egyik sem" option. Visually
   * differentiated with a slate/amber neutral fill and an italic label —
   * unless `isCorrect` also fires, in which case correct styling wins.
   */
  isNone?: boolean;
}

/**
 * Horizontal animated result bar — used on resolved polls and (in
 * compact form) on the post-vote state of active polls.
 *
 * Visual rules:
 *   - The user's own pick is wrapped in the gold accent border so they
 *     can scan the card and know "this was me".
 *   - Resolved polls also paint the correct option emerald; if the user
 *     picked correctly, both styles compose.
 *   - Bar fill uses a Barça-blue → red gradient on neutral options and
 *     swaps to an emerald gradient on the correct one.
 *   - The width animation is `whileInView` so the bars fill as the user
 *     scrolls into the card, never on initial render.
 */
export function PollResultBar({
  label,
  votes,
  totalVotes,
  isUserVote,
  isCorrect,
  index,
  isNone = false,
}: PollResultBarProps) {
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-md)] border",
        "px-3.5 py-2.5 sm:px-4 sm:py-3",
        "transition-colors duration-300",
        isCorrect
          ? "border-emerald-400/50 bg-emerald-400/[0.06]"
          : isUserVote
            ? "border-[var(--accent-gold)]/50 bg-[var(--accent-gold)]/[0.05]"
            : isNone
              ? "border-dashed border-[var(--glass-border-hover)]/70 bg-[var(--glass-bg)]/40"
              : "border-[var(--glass-border)] bg-[var(--glass-bg)]",
      )}
    >
      {/* Animated fill */}
      <motion.div
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 origin-left",
          isCorrect
            ? "bg-gradient-to-r from-emerald-500/40 via-emerald-400/25 to-emerald-300/15"
            : isNone
              ? "bg-gradient-to-r from-slate-400/25 via-amber-500/20 to-slate-400/10"
              : "bg-gradient-to-r from-[var(--accent-blue)]/45 via-[var(--accent-blue)]/25 to-[var(--accent-red)]/30",
        )}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{
          duration: 0.85,
          delay: 0.08 + index * 0.07,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
      />

      {/* Labels */}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isCorrect && (
            <Crown
              size={14}
              className="shrink-0 text-emerald-400"
              aria-label="Helyes válasz"
            />
          )}
          {isUserVote && !isCorrect && (
            <Star
              size={14}
              className="shrink-0 text-[var(--accent-gold)]"
              aria-label="Te szavazatod"
            />
          )}
          {isUserVote && isCorrect && (
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                "bg-emerald-400 text-[#0a0e1a]",
              )}
              aria-label="Helyesen szavaztál"
            >
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          {isNone && !isCorrect && !isUserVote && (
            <HelpCircle
              size={14}
              className="shrink-0 text-[var(--text-muted)]"
              aria-label="Más / Egyik sem"
            />
          )}
          <span
            className={cn(
              "truncate text-sm sm:text-[0.95rem]",
              isCorrect
                ? "font-medium text-emerald-100"
                : isUserVote
                  ? "font-medium text-[var(--text-primary)]"
                  : isNone
                    ? "italic text-[var(--text-muted)]"
                    : "text-[var(--text-secondary)]",
            )}
          >
            {label}
          </span>
        </div>

        <div className="flex shrink-0 items-baseline gap-2">
          <span
            className={cn(
              "font-display text-base tabular-nums tracking-wide sm:text-lg",
              isCorrect
                ? "text-emerald-300"
                : isUserVote
                  ? "text-[var(--accent-gold)]"
                  : "text-[var(--text-primary)]",
            )}
          >
            {pct}%
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {votes.toLocaleString("hu-HU")}
          </span>
        </div>
      </div>
    </div>
  );
}
