"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  fetchTeamForm,
  tallyForm,
  type FormMatch,
  type TeamFormResponse,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";
import { ChartShell } from "./ChartShell";
import {
  CacheLabel,
  ChartSkeleton,
  EmptyBlock,
  ErrorBlock,
} from "./primitives";

interface FormChipsProps {
  season: number;
  index?: number;
  className?: string;
}

/**
 * "Forma — utolsó 10 meccs" — circular W/D/L chips with tooltips.
 *
 * Visual contract:
 *   - Each chip is a 36px roundel: green (W), amber (D), red (L).
 *   - Hover/focus opens a tooltip with opponent name, score and date.
 *   - Stagger fade-in driven by the chip's index (Framer Motion).
 *   - The chips render oldest → newest left-to-right (we reverse the
 *     descending list the API ships with) so the rightmost chip is the
 *     latest result — matches how broadcast graphics depict form.
 */
export function FormChips({ season, index = 0, className }: FormChipsProps) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<TeamFormResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      setLoaded(false);
      setErrorMessage(null);
      setData(null);
    });
    const controller = new AbortController();
    fetchTeamForm({ season }, controller.signal)
      .then((res) => {
        setData(res);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "A formaadatok jelenleg nem elérhetők",
        );
        setLoaded(true);
      });
    return () => controller.abort();
  }, [season, retryNonce]);

  const orderedMatches = useMemo<FormMatch[] | null>(() => {
    if (!data?.matches) return null;
    // API returns desc by date (newest first) — reverse to oldest → newest
    return [...data.matches].reverse();
  }, [data]);

  const tally = useMemo(
    () => (data ? tallyForm(data.matches) : null),
    [data],
  );

  return (
    <ChartShell
      eyebrow="Forma"
      title="Az utolsó 10 La Liga meccs"
      description="Hideg vagy forró? A legfrissebb csapatforma egy pillantásra."
      meta={<CacheLabel cachedAt={data?.cached_at} stale={data?.stale} />}
      index={index}
      className={className}
    >
      {!loaded ? (
        <ChartSkeleton height={140} withAxis={false} />
      ) : errorMessage ? (
        <ErrorBlock
          message={errorMessage}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      ) : !orderedMatches || orderedMatches.length === 0 ? (
        <EmptyBlock message="Még nincs lejátszott bajnoki ebben a szezonban." />
      ) : (
        <div className="space-y-6">
          <ChipsRow matches={orderedMatches} reduced={reduced} />
          {tally && <FormSummary tally={tally} total={orderedMatches.length} />}
        </div>
      )}
    </ChartShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const RESULT_STYLES: Record<
  FormMatch["result"],
  { label: string; bg: string; ring: string; glow: string; long: string }
> = {
  W: {
    label: "G",
    long: "Győzelem",
    bg: "bg-emerald-500/15 text-emerald-300",
    ring: "border-emerald-400/50",
    glow: "shadow-[0_0_18px_rgba(16,185,129,0.25)]",
  },
  D: {
    label: "D",
    long: "Döntetlen",
    bg: "bg-amber-400/15 text-amber-300",
    ring: "border-amber-400/50",
    glow: "shadow-[0_0_18px_rgba(245,158,11,0.20)]",
  },
  L: {
    label: "V",
    long: "Vereség",
    bg: "bg-rose-500/15 text-rose-300",
    ring: "border-rose-400/50",
    glow: "shadow-[0_0_18px_rgba(244,63,94,0.20)]",
  },
};

function ChipsRow({
  matches,
  reduced,
}: {
  matches: FormMatch[];
  reduced: boolean;
}) {
  return (
    <ol
      role="list"
      className="flex flex-wrap gap-2.5"
      aria-label="Utolsó 10 meccs eredménye"
    >
      {matches.map((m, i) => (
        <motion.li
          key={m.match_id}
          initial={reduced ? false : { opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.35,
            delay: reduced ? 0 : i * 0.04,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <Chip match={m} />
        </motion.li>
      ))}
    </ol>
  );
}

function Chip({ match }: { match: FormMatch }) {
  const style = RESULT_STYLES[match.result];
  const opp =
    match.homeTeam.id === 81 ? match.awayTeam.name : match.homeTeam.name;
  const isHome = match.homeTeam.id === 81;
  const date = formatDate(match.utcDate);
  const score = `${match.score.home}–${match.score.away}`;
  const tooltip = `${date} · ${isHome ? "(H)" : "(V)"} ${opp} · ${score}`;

  return (
    <span className="group/chip relative inline-block">
      <span
        role="img"
        aria-label={`${style.long} ${opp} ellen ${score}`}
        title={tooltip}
        className={cn(
          "flex h-9 w-9 items-center justify-center",
          "rounded-full border font-display text-base tracking-wide",
          "transition-transform duration-200",
          "hover:scale-110 group-focus-within/chip:scale-110",
          style.bg,
          style.ring,
          style.glow,
        )}
        tabIndex={0}
      >
        {style.label}
      </span>

      {/* Custom tooltip — visible on hover/focus, hidden by default. */}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2",
          "whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--glass-border)]",
          "bg-[var(--glass-bg-strong)] px-3 py-1.5",
          "text-[11px] text-[var(--text-primary)]",
          "shadow-[var(--shadow-md)] backdrop-blur-md",
          "opacity-0 transition-opacity duration-200",
          "group-hover/chip:opacity-100 group-focus-within/chip:opacity-100",
        )}
      >
        <span className="block font-display text-[10px] uppercase tracking-[0.2em] text-[var(--accent-gold)]">
          {style.long}
        </span>
        <span className="mt-0.5 block">{opp}</span>
        <span className="text-[var(--text-secondary)]">
          {date} · {isHome ? "Hazai" : "Idegen"} · {score}
        </span>
      </span>
    </span>
  );
}

function FormSummary({
  tally,
  total,
}: {
  tally: { wins: number; draws: number; losses: number };
  total: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 text-sm">
      <span className="font-display text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
        Utolsó {total}
      </span>
      <SummaryBadge label="G" value={tally.wins} tone="emerald" />
      <SummaryBadge label="D" value={tally.draws} tone="amber" />
      <SummaryBadge label="V" value={tally.losses} tone="rose" />
      <span className="ml-auto text-xs text-[var(--text-secondary)]">
        Pontszerzési arány:{" "}
        <span className="font-display text-base text-[var(--accent-gold)]">
          {pointsFromTally(tally, total)}%
        </span>
      </span>
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-rose-300";
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span className={cn("font-display text-2xl", toneClass)}>{value}</span>
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {label}
      </span>
    </span>
  );
}

function pointsFromTally(
  t: { wins: number; draws: number; losses: number },
  total: number,
): number {
  if (total === 0) return 0;
  const earned = t.wins * 3 + t.draws;
  const max = total * 3;
  return Math.round((earned / max) * 100);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
