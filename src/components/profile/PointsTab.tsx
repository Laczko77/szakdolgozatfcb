"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Coins,
  TrendingUp,
  Vote,
} from "lucide-react";
import type { PointTransaction } from "@/types/database";
import { PointsTransactionList } from "@/components/polls/PointsTransactionList";
import { cn } from "@/lib/utils";

/**
 * /profil → Pontjaim tab.
 *
 * Mirrors the layout of the standalone /pontjaim page (balance hero +
 * full transaction history) but inside the profile tab pane. Re-uses
 * the F12 `PointsTransactionList` so styling stays in lock-step.
 */

interface PointsTabProps {
  balance: number | null;
  totalEarned: number | null;
  transactions: PointTransaction[];
  loading: boolean;
}

export function PointsTab({
  balance,
  totalEarned,
  transactions,
  loading,
}: PointsTabProps) {
  const { fromPolls, spent } = useMemo(() => {
    const fromPolls = transactions
      .filter((t) => t.poll_id !== null && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const spent = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { fromPolls, spent };
  }, [transactions]);

  return (
    <div className="space-y-8">
      {/* ── Balance hero ──────────────────────────────────────── */}
      <section
        className={cn(
          "glass-card glass-border-gradient",
          "relative overflow-hidden p-5 sm:p-7",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/55 to-transparent"
        />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
              Aktuális egyenleg
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <Coins
                size={24}
                className="text-[var(--accent-gold)]"
                aria-hidden
              />
              <span
                className={cn(
                  "font-display tabular-nums tracking-wide",
                  "text-5xl text-[var(--accent-gold)] sm:text-6xl",
                  "[text-shadow:0_0_28px_var(--accent-gold-subtle)]",
                )}
              >
                {loading || balance === null
                  ? "—"
                  : balance.toLocaleString("hu-HU")}
              </span>
              <span className="font-display text-base uppercase tracking-[0.24em] text-[var(--text-muted)]">
                pont
              </span>
            </div>
          </div>

          <Link
            href="/pont-aruhaz"
            className="glass-button-primary self-start whitespace-nowrap lg:self-end"
          >
            <span>Pont-áruház</span>
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            icon={TrendingUp}
            label="Összesen szerzett"
            value={
              loading || totalEarned === null
                ? "—"
                : totalEarned.toLocaleString("hu-HU")
            }
            tone="gold"
          />
          <StatTile
            icon={Vote}
            label="Szavazásból"
            value={loading ? "—" : fromPolls.toLocaleString("hu-HU")}
            tone="blue"
          />
          <StatTile
            icon={Coins}
            label="Beváltott"
            value={loading ? "—" : spent.toLocaleString("hu-HU")}
            tone="red"
          />
        </div>
      </section>

      {/* ── Transaction history ──────────────────────────────── */}
      <section>
        <header className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
              Tranzakció történet
            </p>
            <h3 className="mt-0.5 font-display text-xl tracking-wide text-[var(--text-primary)] sm:text-[1.45rem]">
              Minden mozgás
            </h3>
          </div>
          {!loading && transactions.length > 0 && (
            <span className="font-display text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {transactions.length} tétel
            </span>
          )}
        </header>

        {loading ? (
          <ul className="space-y-2" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="glass-card flex h-[68px] animate-pulse items-center px-4"
              >
                <div className="h-10 w-10 rounded-full bg-[var(--glass-bg-hover)]" />
                <div className="ml-3.5 flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-[var(--glass-bg-hover)]" />
                  <div className="h-2.5 w-1/3 rounded bg-[var(--glass-bg-hover)]" />
                </div>
                <div className="h-5 w-16 rounded bg-[var(--glass-bg-hover)]" />
              </li>
            ))}
          </ul>
        ) : (
          <PointsTransactionList transactions={transactions} />
        )}
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  tone: "gold" | "blue" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] px-4 py-3.5",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          className={cn(
            tone === "gold" && "text-[var(--accent-gold)]",
            tone === "blue" && "text-[var(--accent-blue)]",
            tone === "red" && "text-[var(--accent-red)]",
          )}
          aria-hidden
        />
        <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-1.5 font-display text-2xl tabular-nums tracking-wide",
          tone === "gold" && "text-[var(--accent-gold)]",
          tone === "blue" && "text-[var(--text-primary)]",
          tone === "red" && "text-[var(--text-primary)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
