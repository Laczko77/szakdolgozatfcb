"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  fetchScorersSnapshot,
  type ScorerSnapshot,
  type ScorersSnapshotResponse,
} from "@/lib/season-api";
import { FOOTBALL_DATA_BARCELONA_NAME } from "@/lib/football-stats-api";
import { cn } from "@/lib/utils";
import { ChartShell } from "./ChartShell";
import {
  CacheLabel,
  ChartSkeleton,
  EmptyBlock,
  ErrorBlock,
} from "./primitives";

interface TopScorersSnapshotProps {
  season: number;
  index?: number;
  className?: string;
}

/**
 * "Top gólszerzők" — animated horizontal bar chart for the season's top 10.
 *
 * The football-data.org free tier does NOT expose per-matchday scorer
 * history (the backend exposes that with `evolution_supported: false`),
 * so this is a single point-in-time snapshot. We compensate visually
 * with a Framer Motion stagger that grows each bar from 0% width to its
 * final percentage — borrowing the "race" feel without the underlying
 * data.
 *
 * Barça scorers (matched by team name, since the backend drops `team.id`
 * for scorers) get the gold accent. Non-Barça bars are muted glass.
 */
export function TopScorersSnapshot({
  season,
  index = 0,
  className,
}: TopScorersSnapshotProps) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<ScorersSnapshotResponse | null>(null);
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
    fetchScorersSnapshot({ season, limit: 10 }, controller.signal)
      .then((res) => {
        setData(res);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "A gólszerzők listája jelenleg nem elérhető",
        );
        setLoaded(true);
      });
    return () => controller.abort();
  }, [season, retryNonce]);

  const maxGoals = useMemo(() => {
    if (!data?.scorers || data.scorers.length === 0) return 0;
    return Math.max(...data.scorers.map((s) => s.goals));
  }, [data]);

  return (
    <ChartShell
      eyebrow="Top gólszerzők"
      title="A liga gólkirályai"
      description="A szezon top 10 gólszerzője — pillanatfelvétel az aktuális állással."
      meta={<CacheLabel cachedAt={data?.cached_at} stale={data?.stale} />}
      index={index}
      className={className}
      footer={
        <div className="flex items-start gap-2 text-[var(--text-muted)]">
          <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
          <p>
            Az évad pillanatfelvétele — fordulónkénti evolúció a
            football-data.org ingyenes csomagjában nem elérhető.
          </p>
        </div>
      }
    >
      {!loaded ? (
        <ChartSkeleton height={420} withAxis={false} />
      ) : errorMessage ? (
        <ErrorBlock
          message={errorMessage}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      ) : !data || data.scorers.length === 0 ? (
        <EmptyBlock message="Még nem áll rendelkezésre gólszerző-statisztika." />
      ) : (
        <ol className="space-y-3">
          {data.scorers.map((scorer, i) => (
            <ScorerBar
              key={`${scorer.player.id}-${i}`}
              rank={i + 1}
              scorer={scorer}
              maxGoals={maxGoals}
              reduced={reduced}
              index={i}
            />
          ))}
        </ol>
      )}
    </ChartShell>
  );
}

// ---------------------------------------------------------------------------
// Bar row
// ---------------------------------------------------------------------------

interface ScorerBarProps {
  rank: number;
  scorer: ScorerSnapshot;
  maxGoals: number;
  reduced: boolean;
  index: number;
}

function ScorerBar({
  rank,
  scorer,
  maxGoals,
  reduced,
  index,
}: ScorerBarProps) {
  const isBarca = scorer.team.name === FOOTBALL_DATA_BARCELONA_NAME;
  const widthPercent = maxGoals > 0 ? (scorer.goals / maxGoals) * 100 : 0;

  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 rounded-[var(--radius-md)]",
        "border border-transparent px-3 py-2.5",
        "transition-colors duration-200 hover:bg-[var(--glass-bg-hover)]",
        isBarca && "bg-[var(--accent-gold)]/8 border-[var(--accent-gold)]/30",
      )}
    >
      {/* Rank */}
      <span
        className={cn(
          "w-6 shrink-0 text-center font-display text-base tabular-nums",
          isBarca
            ? "text-[var(--accent-gold)]"
            : rank <= 3
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-secondary)]",
        )}
      >
        {rank}
      </span>

      {/* Crest */}
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center",
          "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        )}
      >
        {scorer.team.crest ? (
          <Image
            src={scorer.team.crest}
            alt={scorer.team.name}
            width={28}
            height={28}
            unoptimized
            className="h-[78%] w-[78%] object-contain"
          />
        ) : (
          <span className="font-display text-[10px] text-[var(--accent-gold)]">
            {scorer.team.name.slice(0, 3).toUpperCase()}
          </span>
        )}
      </span>

      {/* Identity + bar */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "truncate text-sm font-medium",
              isBarca
                ? "text-[var(--accent-gold)]"
                : "text-[var(--text-primary)]",
            )}
            title={scorer.player.name}
          >
            {scorer.player.name}
          </span>
          <span className="flex shrink-0 items-baseline gap-2 text-xs text-[var(--text-secondary)]">
            <span className="hidden sm:inline">{scorer.team.name}</span>
            <span className="font-display text-xl tabular-nums text-[var(--text-primary)]">
              {scorer.goals}
            </span>
          </span>
        </div>

        {/* Bar */}
        <div
          className={cn(
            "mt-1.5 h-2 overflow-hidden rounded-full",
            "bg-[var(--glass-bg)]",
          )}
        >
          <motion.span
            initial={reduced ? false : { width: 0 }}
            whileInView={{ width: `${widthPercent}%` }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: reduced ? 0 : 0.9,
              delay: reduced ? 0 : 0.1 + index * 0.05,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className={cn(
              "block h-full rounded-full",
              isBarca
                ? "bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-gold)] to-[var(--accent-gold)]"
                : "bg-[var(--glass-border-hover)]",
            )}
            aria-hidden
          />
        </div>

        {/* Subline (mobile shows team here since the inline label is hidden). */}
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] sm:justify-end">
          <span className="sm:hidden">{scorer.team.name}</span>
          <span className="tabular-nums">
            {scorer.assists} gólpassz · {scorer.playedMatches} meccs
          </span>
        </div>
      </div>
    </li>
  );
}
