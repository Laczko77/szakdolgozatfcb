"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { SeasonSelect, type SeasonOption } from "@/components/season/SeasonSelect";
import { PointsEvolutionChart } from "@/components/season/PointsEvolutionChart";
import { FormChips } from "@/components/season/FormChips";
import { GoalDifferenceChart } from "@/components/season/GoalDifferenceChart";
import { TopScorersSnapshot } from "@/components/season/TopScorersSnapshot";
import { MatchesTimeline } from "@/components/season/MatchesTimeline";
import { TeamStatsWidget } from "@/components/season/TeamStatsWidget";
import { TransfersWidget } from "@/components/season/TransfersWidget";
import {
  fetchTeamForm,
  tallyForm,
  FCB_TEAM_ID,
  type FormMatch,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";

/**
 * /season — La Liga season story page.
 *
 * Layout (post-redesign):
 *   1. Glass hero card — section-styled, no radial gradient washes.
 *      Holds the eyebrow, headline, copy, season select and three
 *      snapshot stat tiles inside a single .glass-card.
 *   2. Sticky mini-header — pill that surfaces W/D/L + season switcher
 *      after 200px of scroll.
 *   3. Charts row 1 — Pontok evolúciója + Forma chipek (3-col grid).
 *   4. Csapat statisztikák — 6-tile Sofascore snapshot.
 *   5. Gólkülönbség — area chart.
 *   6. Top gólszerzők — bar list.
 *   7. Átigazolások — érkezők/távozók 2-col panel.
 *   8. Meccsek timeline.
 *
 * The original "blaugrana magazine" treatment (radial hero, diagonal
 * dividers, oversized type) was replaced to match the rest of the
 * portal's dark glass language. Charts now default to 200/240px tall
 * with a "Nagyítás" affordance on each card opening a 600px modal.
 */

const SEASON_OPTIONS: ReadonlyArray<SeasonOption> = [
  { value: 2025, label: "2025/26" },
  { value: 2024, label: "2024/25" },
] as const;

interface DerivedSeasonTotals {
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
}

const ZERO_TOTALS: DerivedSeasonTotals = {
  wins: 0,
  draws: 0,
  losses: 0,
  goalsScored: 0,
  goalsConceded: 0,
};

// ---------------------------------------------------------------------------
// Inner page (uses useSearchParams — must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function SeasonPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const season = readSeasonFromQuery(searchParams.get("season"));

  const handleSeasonChange = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("season", String(next));
      router.replace(`/season?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const seasonLabel = useMemo(
    () => SEASON_OPTIONS.find((o) => o.value === season)?.label ?? "—",
    [season],
  );

  // ---------------------------------------------------------------------
  // Derive W/D/L + goals for the hero stat tiles. The endpoint is
  // server-cached so polling it here is essentially free.
  // ---------------------------------------------------------------------
  const [totals, setTotals] = useState<DerivedSeasonTotals>(ZERO_TOTALS);
  const [totalsLoading, setTotalsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    // Wrap in queueMicrotask to satisfy `react-hooks/set-state-in-effect`
    // under React 19 — the synchronous setState in an effect body is a
    // cascading-render foot-gun the lint rule blocks. Microtask defers
    // the call past the initial render commit.
    queueMicrotask(() => setTotalsLoading(true));

    fetchTeamForm({ season }, controller.signal)
      .then((response) => {
        const derived = deriveTotals(response.matches);
        setTotals(derived);
        setTotalsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Soft-fail: keep zero counters but stop the skeleton.
        setTotalsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [season]);

  // ---------------------------------------------------------------------
  // Sticky mini-header — appears after 200px of scroll.
  // ---------------------------------------------------------------------
  const { scrollY } = useScroll();
  const [showSticky, setShowSticky] = useState(false);
  useMotionValueEvent(scrollY, "change", (latest: number) => {
    const next = latest > 200;
    setShowSticky((prev) => (prev === next ? prev : next));
  });

  return (
    <>
      {/* ─────────────── STICKY MINI-HEADER ─────────────── */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            key="season-sticky"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-5"
          >
            <div className="glass-nav flex items-center gap-3 rounded-full px-4 py-2 sm:gap-5 sm:px-5">
              <span className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                FCB · {seasonLabel}
              </span>
              <span
                aria-hidden
                className="hidden h-4 w-px bg-[var(--glass-border)] sm:block"
              />
              <div className="hidden items-center gap-1.5 sm:flex">
                <ResultPip tone="win" count={totals.wins} />
                <ResultPip tone="draw" count={totals.draws} />
                <ResultPip tone="loss" count={totals.losses} />
              </div>
              <span
                aria-hidden
                className="hidden h-4 w-px bg-[var(--glass-border)] sm:block"
              />
              <SeasonSelect
                value={season}
                options={SEASON_OPTIONS}
                onChange={handleSeasonChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        {/* ─────────────── HERO CARD ─────────────── */}
        <SeasonHero
          seasonLabel={seasonLabel}
          season={season}
          onSeasonChange={handleSeasonChange}
          totals={totals}
          totalsLoading={totalsLoading}
        />

        {/* ─────────────── ROW 1 — POINTS + FORM ─────────────── */}
        <SectionSpacing>
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
            <PointsEvolutionChart
              season={season}
              index={0}
              className="lg:col-span-2"
            />
            <FormChips season={season} index={1} className="lg:col-span-1" />
          </div>
        </SectionSpacing>

        {/* ─────────────── TEAM STATS ─────────────── */}
        <SectionSpacing>
          <TeamStatsWidget season={season} index={0} />
        </SectionSpacing>

        {/* ─────────────── GOAL DIFFERENCE ─────────────── */}
        <SectionSpacing>
          <GoalDifferenceChart season={season} index={0} />
        </SectionSpacing>

        {/* ─────────────── TOP SCORERS ─────────────── */}
        <SectionSpacing>
          <TopScorersSnapshot season={season} index={0} />
        </SectionSpacing>

        {/* ─────────────── TRANSFERS (auto-hides on 404) ─────────────── */}
        <SectionSpacing>
          <TransfersWidget index={0} />
        </SectionSpacing>

        {/* ─────────────── MATCHES TIMELINE ─────────────── */}
        <SectionSpacing>
          <MatchesTimeline season={season} index={0} />
        </SectionSpacing>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero — single glass card, no radial gradients
// ---------------------------------------------------------------------------

interface SeasonHeroProps {
  seasonLabel: string;
  season: number;
  onSeasonChange: (next: number) => void;
  totals: DerivedSeasonTotals;
  totalsLoading: boolean;
}

function SeasonHero({
  seasonLabel,
  season,
  onSeasonChange,
  totals,
  totalsLoading,
}: SeasonHeroProps) {
  const totalMatches = totals.wins + totals.draws + totals.losses;
  const goalDiff = totals.goalsScored - totals.goalsConceded;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass-card relative overflow-hidden p-6 sm:p-8 lg:p-10"
    >
      {/* Subtle top hairline — keeps the gold accent without the radial wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/45 to-transparent"
      />

      {/* Eyebrow + headline */}
      <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[var(--accent-gold)]">
        Forca Barça // La Liga {seasonLabel}
      </p>
      <h1
        className={cn(
          "mt-4 font-display leading-[0.95] tracking-wide",
          "text-[var(--text-primary)]",
          "text-4xl sm:text-6xl lg:text-7xl",
        )}
      >
        A teljes szezon
        <br />
        <span className="text-[var(--accent-gold)]">egy pillantásra</span>
      </h1>

      {/* Copy + season select */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
        <p className="lg:col-span-8 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
          Pontok, gólkülönbség, forma és gólkirályok — fordulóról fordulóra
          követjük az FCB szezonjának ívét. Görgess végig az adatokon, vagy
          válts másik szezonra.
        </p>

        <div className="lg:col-span-4 flex flex-col gap-2 lg:items-end">
          <span className="font-display text-[10px] uppercase tracking-[0.35em] text-[var(--text-muted)]">
            Szezon
          </span>
          <SeasonSelect
            value={season}
            options={SEASON_OPTIONS}
            onChange={onSeasonChange}
          />
        </div>
      </div>

      {/* Snapshot stat tiles — 3 glass cards inside the hero */}
      <div className="mt-8 grid grid-cols-3 gap-3 sm:mt-10 sm:gap-4">
        <SnapshotTile
          label="Mérkőzés"
          value={totalMatches}
          loading={totalsLoading}
          tone="primary"
        />
        <SnapshotTile
          label="Győzelem"
          value={totals.wins}
          loading={totalsLoading}
          tone="gold"
        />
        <SnapshotTile
          label="Gólkülönbség"
          value={goalDiff}
          loading={totalsLoading}
          tone="blue"
          signed
        />
      </div>
    </motion.section>
  );
}

interface SnapshotTileProps {
  label: string;
  value: number;
  loading: boolean;
  tone: "primary" | "gold" | "blue";
  signed?: boolean;
}

function SnapshotTile({
  label,
  value,
  loading,
  tone,
  signed = false,
}: SnapshotTileProps) {
  const formatted = signed && value > 0 ? `+${value}` : String(value);
  const numberTone =
    tone === "gold"
      ? "text-[var(--accent-gold)]"
      : tone === "blue"
        ? "text-[#7aa6ff]"
        : "text-[var(--text-primary)]";

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] p-4 sm:p-5",
      )}
    >
      {loading ? (
        <span className="block h-10 w-16 animate-pulse rounded-md bg-[var(--glass-bg-hover)] sm:h-14 sm:w-24" />
      ) : (
        <span
          className={cn(
            "block font-display leading-none tabular-nums",
            "text-3xl sm:text-5xl lg:text-6xl",
            numberTone,
          )}
        >
          {formatted}
        </span>
      )}
      <span className="mt-3 block font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-secondary)] sm:text-[11px]">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section spacing — replaces the old DiagonalDivider
// ---------------------------------------------------------------------------

function SectionSpacing({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 sm:mt-12 lg:mt-14">{children}</div>;
}

// ---------------------------------------------------------------------------
// Result pip — used in sticky mini-header
// ---------------------------------------------------------------------------

interface ResultPipProps {
  tone: "win" | "draw" | "loss";
  count: number;
}

function ResultPip({ tone, count }: ResultPipProps) {
  const palette =
    tone === "win"
      ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] border-[var(--accent-gold)]/30"
      : tone === "draw"
        ? "bg-[var(--glass-bg-hover)] text-[var(--text-secondary)] border-[var(--glass-border)]"
        : "bg-[#ff8aa6]/10 text-[#ff8aa6] border-[#ff8aa6]/25";
  const label = tone === "win" ? "GY" : tone === "draw" ? "D" : "V";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "font-display text-[10px] uppercase tracking-[0.2em] tabular-nums",
        palette,
      )}
      aria-label={`${tone}: ${count}`}
    >
      <span>{label}</span>
      <span>{count}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSeasonFromQuery(raw: string | null): number {
  if (!raw) return 2025;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) return 2025;
  if (SEASON_OPTIONS.some((o) => o.value === parsed)) return parsed;
  return 2025;
}

function deriveTotals(matches: FormMatch[]): DerivedSeasonTotals {
  const { wins, draws, losses } = tallyForm(matches);
  let goalsScored = 0;
  let goalsConceded = 0;
  for (const m of matches) {
    const isHome = m.homeTeam.id === FCB_TEAM_ID;
    if (isHome) {
      goalsScored += m.score.home;
      goalsConceded += m.score.away;
    } else {
      goalsScored += m.score.away;
      goalsConceded += m.score.home;
    }
  }
  return { wins, draws, losses, goalsScored, goalsConceded };
}

// ---------------------------------------------------------------------------
// Suspense wrapper
// ---------------------------------------------------------------------------

export default function SeasonPage() {
  return (
    <Suspense fallback={<SeasonFallback />}>
      <SeasonPageInner />
    </Suspense>
  );
}

function SeasonFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <div className="glass-card p-8 sm:p-10">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="mt-6 h-16 w-3/4 animate-pulse rounded-md bg-[var(--glass-bg-hover)] sm:h-24" />
        <div className="mt-4 h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "glass-card h-64 animate-pulse",
              i === 0 && "lg:col-span-2",
            )}
          />
        ))}
      </div>
    </div>
  );
}
