"use client";

import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Gift,
  Sparkles,
  Vote,
} from "lucide-react";
import type { PointTransaction } from "@/types/database";
import { formatDateTime } from "@/lib/format";
import { formatPointReason } from "@/lib/i18n/transaction-reasons";
import { cn } from "@/lib/utils";

interface PointsTransactionListProps {
  transactions: PointTransaction[];
  className?: string;
}

/**
 * Vertical list of point transactions, newest first.
 *
 * Reasons get an icon hint based on the text — we don't have a typed
 * `kind` column, so we sniff well-known prefixes ("Szavazás",
 * "Kupon"…). Unknown reasons fall back to a neutral coin icon.
 *
 * The "+50 / -200" amount is rendered tabular-nums so the column lines
 * up cleanly even with mixed-length numbers.
 */
export function PointsTransactionList({
  transactions,
  className,
}: PointsTransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div
        className={cn(
          "glass-card flex flex-col items-center gap-3 px-6 py-10 text-center",
          "border-dashed",
          className,
        )}
      >
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          )}
        >
          <Coins size={20} className="text-[var(--text-muted)]" aria-hidden />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Még nincs pontmozgás. Vegyél részt szavazáson, vagy nézz körül a
          pont-áruházban.
        </p>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {transactions.map((tx, i) => {
        // Translate the raw `reason` column to a Hungarian label. The icon
        // resolver still receives the original (English) reason because
        // it sniffs by keyword family — but the visible copy is
        // localised. See lib/i18n/transaction-reasons.ts.
        const reasonLabel = formatPointReason(tx.reason);
        return (
        <motion.li
          key={tx.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: Math.min(i * 0.04, 0.32),
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className={cn(
            "glass-card flex items-center gap-3.5 px-4 py-3.5",
            "transition-all duration-200",
            "hover:bg-[var(--glass-bg-hover)]",
          )}
        >
          <TransactionIcon reason={tx.reason} amount={tx.amount} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--text-primary)]">
              {reasonLabel}
            </p>
            <time
              dateTime={tx.created_at}
              className="text-[11px] text-[var(--text-muted)]"
            >
              {formatDateTime(tx.created_at)}
            </time>
          </div>

          <div className="flex items-baseline gap-1.5 shrink-0">
            <span
              className={cn(
                "font-display text-lg tabular-nums tracking-wide sm:text-xl",
                tx.amount >= 0
                  ? "text-[var(--accent-gold)]"
                  : "text-[var(--accent-red)]",
              )}
            >
              {tx.amount >= 0 ? "+" : ""}
              {tx.amount.toLocaleString("hu-HU")}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              pont
            </span>
          </div>
        </motion.li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

function TransactionIcon({
  reason,
  amount,
}: {
  reason: string;
  amount: number;
}) {
  // The `reason` column stores the raw machine identifier (e.g.
  // "poll_win", "coupon_redeem"). We sniff that — NOT the Hungarian
  // display label — so the icon mapping is stable regardless of how
  // the translation map evolves.
  const key = reason.toLowerCase();
  const positive = amount >= 0;

  let Icon = Coins;
  let tone: "gold" | "blue" | "red" = positive ? "gold" : "red";

  if (key.includes("poll")) {
    Icon = Vote;
    tone = positive ? "gold" : "red";
  } else if (key.includes("coupon") || key.includes("redeem")) {
    Icon = Gift;
    tone = "blue";
  } else if (key.includes("bonus") || key.includes("registration")) {
    Icon = Sparkles;
    tone = "gold";
  } else if (positive) {
    Icon = ArrowUpRight;
  } else {
    Icon = ArrowDownRight;
  }

  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        tone === "gold" &&
          "border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]",
        tone === "blue" &&
          "border border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]",
        tone === "red" &&
          "border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/12 text-[var(--accent-red)]",
      )}
    >
      <Icon size={16} aria-hidden />
    </span>
  );
}
