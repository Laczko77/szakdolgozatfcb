"use client";

import { Coins, TrendingUp } from "lucide-react";
import type { PointTransaction } from "@/types/database";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WidgetShell } from "./WidgetShell";

interface PointsWidgetProps {
  balance: number;
  totalEarned: number;
  lastTransaction: PointTransaction | null;
  index?: number;
  className?: string;
}

/**
 * Pontegyenleg widget.
 *
 * Centerpiece is the balance number rendered in Bebas Neue at a chunky
 * 6xl — the dashboard's only place where a number gets to be the hero.
 * Below: the most recent transaction (if any) gives a quick "what
 * changed" hint without needing to open the full point history.
 *
 * Total earned is shown as a small caption — useful for users tracking
 * lifetime activity, but doesn't fight the live balance for attention.
 */
export function PointsWidget({
  balance,
  totalEarned,
  lastTransaction,
  index = 0,
  className,
}: PointsWidgetProps) {
  return (
    <WidgetShell
      eyebrow="Pontegyenleg"
      title="Forca pontok"
      cta={{ label: "Pont-áruház", href: "/pont-aruhaz" }}
      index={index}
      className={className}
    >
      <div className="space-y-5">
        {/* Balance hero */}
        <div className="relative">
          <div className="flex items-baseline gap-2">
            <Coins
              size={20}
              className="text-[var(--accent-gold)]"
              aria-hidden
            />
            <span
              className={cn(
                "font-display tracking-wide tabular-nums",
                "text-5xl text-[var(--accent-gold)] sm:text-6xl",
                "[text-shadow:0_0_24px_var(--accent-gold-subtle)]",
              )}
            >
              {balance.toLocaleString("hu-HU")}
            </span>
            <span className="font-display text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">
              pont
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <TrendingUp size={12} aria-hidden />
            <span>
              Összesen szerzett:{" "}
              <strong className="text-[var(--text-primary)]">
                {totalEarned.toLocaleString("hu-HU")}
              </strong>{" "}
              pont
            </span>
          </div>
        </div>

        {/* Last transaction */}
        <div
          className={cn(
            "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
            "bg-[var(--glass-bg)] p-3",
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Utolsó tranzakció
          </p>
          {lastTransaction ? (
            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <p className="line-clamp-2 text-sm text-[var(--text-secondary)]">
                {lastTransaction.reason}
              </p>
              <span
                className={cn(
                  "shrink-0 font-display text-base tabular-nums tracking-wide",
                  lastTransaction.amount >= 0
                    ? "text-[var(--accent-gold)]"
                    : "text-[var(--accent-red)]",
                )}
              >
                {lastTransaction.amount >= 0 ? "+" : ""}
                {lastTransaction.amount.toLocaleString("hu-HU")}
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Még nem szereztél pontot. Vegyél részt szavazásokon, vagy nézz
              körül a pont-áruházban.
            </p>
          )}
          {lastTransaction && (
            <time
              dateTime={lastTransaction.created_at}
              className="mt-1 block text-[11px] text-[var(--text-muted)]"
            >
              {formatDate(lastTransaction.created_at)}
            </time>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
