"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransferEntry {
  playerName: string;
  playerId: number | null;
  direction: "in" | "out";
  fromTeam: string | null;
  toTeam: string | null;
  transferDate: string | null;
  fee: number | null;
  feeCurrency: string | null;
  transferType: string | null;
}

interface TransfersResponse {
  transfers: {
    transfersIn: TransferEntry[];
    transfersOut: TransferEntry[];
  };
  cached_at: string;
  stale?: boolean;
}

interface TransfersWidgetProps {
  index?: number;
  className?: string;
  /** Cap each column at this many rows (default 6). */
  limit?: number;
}

/**
 * "Átigazolások" — split-column feed of FCB inbound and outbound transfers.
 *
 * Self-fetches `/api/team/transfers` (the endpoint is parameter-free —
 * Sofascore returns the most recent activity globally for the club). When
 * the upstream is unreachable, the widget hides itself rather than blocking
 * the season page.
 *
 * Each side renders up to `limit` rows; the rest are reported as
 * "+N további" footnote so the section never grows unbounded.
 */
export function TransfersWidget({
  index = 0,
  className,
  limit = 6,
}: TransfersWidgetProps) {
  const [data, setData] = useState<TransfersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setHidden(false);
      setData(null);
    });

    fetch("/api/team/transfers", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          setHidden(true);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as TransfersResponse;
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setHidden(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (hidden) return null;

  const transfersIn = data?.transfers.transfersIn ?? [];
  const transfersOut = data?.transfers.transfersOut ?? [];
  const isEmpty =
    !loading && transfersIn.length === 0 && transfersOut.length === 0;

  // Hide entirely when the API returned 200 but no entries — there's no
  // value-add in showing two empty columns.
  if (isEmpty) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.06, 0.3),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "glass-card glass-card-hover relative overflow-hidden p-6 sm:p-8",
        className,
      )}
      aria-label="Átigazolások"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />

      <header className="mb-6">
        <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
          Sofascore · Mozgások
        </p>
        <h2 className="mt-2 font-display text-2xl tracking-wide text-[var(--text-primary)] sm:text-[1.75rem]">
          Átigazolások
        </h2>
        <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
          Az utóbbi időszak érkezői és távozói — a Sofascore által közölt
          legfrissebb mozgások.
        </p>
      </header>

      {loading ? (
        <TransfersSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <Column
            title="Érkezők"
            tone="emerald"
            entries={transfersIn}
            limit={limit}
          />
          <Column
            title="Távozók"
            tone="rose"
            entries={transfersOut}
            limit={limit}
          />
        </div>
      )}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

interface ColumnProps {
  title: string;
  tone: "emerald" | "rose";
  entries: TransferEntry[];
  limit: number;
}

function Column({ title, tone, entries, limit }: ColumnProps) {
  const accent =
    tone === "emerald"
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
      : "text-rose-300 border-rose-400/30 bg-rose-500/10";
  const Icon = tone === "emerald" ? ArrowDownLeft : ArrowUpRight;

  const visible = entries.slice(0, limit);
  const remaining = Math.max(0, entries.length - visible.length);

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] p-4 sm:p-5",
      )}
    >
      <header className="mb-4 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full border",
            accent,
          )}
        >
          <Icon size={15} aria-hidden />
        </span>
        <p className="font-display text-xs uppercase tracking-[0.32em] text-[var(--text-secondary)]">
          {title}
        </p>
        <span className="ml-auto font-display text-2xl leading-none tabular-nums text-[var(--text-primary)] sm:text-3xl">
          {entries.length}
        </span>
      </header>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Nincs nyilvántartott mozgás.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((entry, i) => (
            <TransferRow key={`${entry.playerName}-${i}`} entry={entry} />
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
          +{remaining} további
        </p>
      )}
    </div>
  );
}

function TransferRow({ entry }: { entry: TransferEntry }) {
  const counterparty =
    entry.direction === "in" ? entry.fromTeam : entry.toTeam;
  return (
    <li
      className={cn(
        "rounded-[var(--radius-sm)] border border-transparent",
        "bg-[var(--bg-primary)]/30 px-3 py-3",
        "transition-colors duration-200 hover:border-[var(--glass-border-hover)]",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-base font-medium text-[var(--text-primary)]">
          {entry.playerName}
        </span>
        {entry.fee != null && (
          <span className="shrink-0 font-display text-base tabular-nums text-[var(--accent-gold)] sm:text-lg">
            {formatFee(entry.fee, entry.feeCurrency)}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span className="truncate">
          {counterparty ?? (entry.transferType ?? "—")}
        </span>
        {entry.transferDate && (
          <span className="shrink-0 tabular-nums">
            {formatDate(entry.transferDate)}
          </span>
        )}
      </div>
    </li>
  );
}

function TransfersSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6" aria-hidden>
      {Array.from({ length: 2 }).map((_, col) => (
        <div
          key={col}
          className={cn(
            "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
            "bg-[var(--glass-bg)] p-4",
          )}
        >
          <span className="block h-3 w-20 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 4 }).map((__, i) => (
              <span
                key={i}
                className="block h-9 animate-pulse rounded-md bg-[var(--glass-bg-hover)]"
                style={{ animationDelay: `${(col * 4 + i) * 60}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFee(value: number, currency: string | null): string {
  // Sofascore reports raw EUR values, often in millions. We collapse to a
  // human-readable form (€12,5 M) and fall through for currencies we don't
  // recognise — better to show the raw number than a wrong symbol.
  const symbol = currency === "EUR" ? "€" : (currency ?? "");
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted = millions
      .toFixed(millions >= 10 ? 0 : 1)
      .replace(".", ",");
    return `${symbol}${formatted} M`;
  }
  if (value >= 1_000) {
    const thousands = Math.round(value / 1_000);
    return `${symbol}${thousands} k`;
  }
  return `${symbol}${value}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("hu-HU", {
    year: "2-digit",
    month: "short",
    day: "2-digit",
  });
}
