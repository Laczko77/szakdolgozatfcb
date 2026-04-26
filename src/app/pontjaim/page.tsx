"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Coins, TrendingUp, Vote } from "lucide-react";
import type { PointTransaction } from "@/types/database";
import { fetchPoints } from "@/lib/dashboard-api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PointsTransactionList } from "@/components/polls/PointsTransactionList";
import { cn } from "@/lib/utils";

/**
 * /pontjaim — point balance & transaction history.
 *
 * Standalone page until F10 builds the proper /profil shell with tabs;
 * the F12 backlog item ("Profil 'Pontjaim' tab frissítése") is met by
 * making this page the canonical destination — F10 will simply pull
 * the same data into a tab pane.
 *
 * Layout:
 *   - Hero card centred on the balance (Bebas Neue, gold, 7xl).
 *   - Lifetime earned + a single CTA into the polls page so users can
 *     immediately go earn more.
 *   - Full transaction history below, newest first.
 */
export default function PontjaimPage() {
  return (
    <ProtectedRoute>
      <PontjaimContent />
    </ProtectedRoute>
  );
}

function PontjaimContent() {
  const { user } = useAuth();
  const toast = useToast();

  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchPoints(controller.signal);
        setBalance(res.balance.balance);
        setTotalEarned(res.balance.total_earned);
        setTransactions(res.transactions);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        toast.error(
          err instanceof Error
            ? err.message
            : "Pontegyenleg betöltése sikertelen",
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [user?.id, toast]);

  const stats = useMemo(() => {
    const fromPolls = transactions
      .filter((t) => t.poll_id !== null && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const spent = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { fromPolls, spent };
  }, [transactions]);

  return (
    <div className="mx-auto max-w-[1024px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 sm:mb-8"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Pontjaim
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-4xl sm:text-6xl",
          )}
        >
          Pontmozgásaim
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          Itt láthatod az aktuális Forca pontegyenlegedet, az eddig
          megszerzett összes pontot, és minden tranzakció részletes listáját.
        </p>
      </motion.header>

      {/* Balance hero */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05, ease: "easeOut" }}
        className={cn(
          "glass-card glass-border-gradient",
          "relative flex flex-col gap-6 overflow-hidden p-6 sm:p-8",
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
                size={26}
                className="text-[var(--accent-gold)]"
                aria-hidden
              />
              <span
                className={cn(
                  "font-display tabular-nums tracking-wide",
                  "text-6xl text-[var(--accent-gold)] sm:text-7xl",
                  "[text-shadow:0_0_28px_var(--accent-gold-subtle)]",
                )}
              >
                {loading ? "—" : balance.toLocaleString("hu-HU")}
              </span>
              <span className="font-display text-base uppercase tracking-[0.24em] text-[var(--text-muted)]">
                pont
              </span>
            </div>
          </div>

          <Link
            href="/pont-aruhaz"
            className={cn(
              "glass-button-primary self-start whitespace-nowrap",
              "lg:self-end",
            )}
          >
            <span>Pont-áruház</span>
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            icon={TrendingUp}
            label="Összesen szerzett"
            value={loading ? "—" : totalEarned.toLocaleString("hu-HU")}
            tone="gold"
          />
          <StatTile
            icon={Vote}
            label="Szavazásból"
            value={loading ? "—" : stats.fromPolls.toLocaleString("hu-HU")}
            tone="blue"
          />
          <StatTile
            icon={Coins}
            label="Beváltott"
            value={loading ? "—" : stats.spent.toLocaleString("hu-HU")}
            tone="red"
          />
        </div>
      </motion.section>

      {/* Transaction history */}
      <section className="mt-10 sm:mt-14">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 flex items-end justify-between gap-4 sm:mb-6"
        >
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
              Tranzakció történet
            </p>
            <h2 className="mt-0.5 font-display text-2xl tracking-wide text-[var(--text-primary)] sm:text-[1.6rem]">
              Minden mozgás
            </h2>
          </div>
          {!loading && transactions.length > 0 && (
            <span className="font-display text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {transactions.length} tétel
            </span>
          )}
        </motion.div>

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

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

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
