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
import { SeasonStatBar } from "@/components/season/SeasonStatBar";
import {
  fetchTeamForm,
  tallyForm,
  FCB_TEAM_ID,
  type FormMatch,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";

/**
 * /season — La Liga season story page (F31, magazine redesign).
 *
 * Cinematic, scroll-driven layout:
 *   1. Hero — radial blaugrana wash, oversized Bebas Neue title.
 *   2. SeasonStatBar — full-width animated counter strip.
 *   3. Magazine rows — alternating column counts separated by diagonal
 *      blaugrana dividers, each charted section with its own eyebrow
 *      and editorial framing.
 *   4. Sticky mini-header — appears after 200px of scroll, condenses
 *      season + W/D/L into a glass pill at the top of the viewport.
 *
 * URL state is preserved (`?season=YYYY`) and the page re-mounts the
 * SeasonStatBar on season change to retrigger its counter animation.
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
  // Derive W/D/L + goals for the hero stat bar.
  // The endpoint is server-cached; fetching here in addition to
  // MatchesTimeline still hits the same Supabase cache, so it's cheap.
  // ---------------------------------------------------------------------
  const [totals, setTotals] = useState<DerivedSeasonTotals>(ZERO_TOTALS);
  const [totalsLoading, setTotalsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setTotalsLoading(true);

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
  // Sticky mini-header — appears after 200px of scroll
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
            <div className="glass-card flex items-center gap-3 rounded-full px-4 py-2 sm:gap-5 sm:px-5">
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

      <div className="mx-auto max-w-[1280px] px-4 pb-24 pt-4 sm:px-6 sm:pt-8 lg:px-10">
        {/* ─────────────── CINEMATIC HERO ─────────────── */}
        <SeasonHero
          seasonLabel={seasonLabel}
          season={season}
          onSeasonChange={handleSeasonChange}
          totals={totals}
          totalsLoading={totalsLoading}
        />

        {/* ─────────────── STAT BAR ─────────────── */}
        {/* Re-key on season → retriggers the counter on season swap. */}
        <SeasonStatBar
          key={`statbar-${season}`}
          wins={totals.wins}
          draws={totals.draws}
          losses={totals.losses}
          goalsScored={totals.goalsScored}
          goalsConceded={totals.goalsConceded}
          loading={totalsLoading}
          className="mt-8 sm:mt-10"
        />

        {/* ─────────────── ROW 1 — POINTS + FORM ─────────────── */}
        <SectionLabel index={1} eyebrow="Capítulo I" title="A pont-ívek" />
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
          <PointsEvolutionChart
            season={season}
            index={0}
            className="lg:col-span-2"
          />
          <FormChips season={season} index={1} className="lg:col-span-1" />
        </div>

        <DiagonalDivider />

        {/* ─────────────── ROW 2 — GOAL DIFFERENCE ─────────────── */}
        <SectionLabel index={2} eyebrow="Capítulo II" title="Gólarány" />
        {/* Decorative blaugrana band sits above the chart */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-2 left-0 right-0 h-[3px] rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--accent-red) 0%, var(--accent-blue) 50%, var(--accent-gold) 100%)",
              filter: "drop-shadow(0 0 12px rgba(196,163,77,0.35))",
              opacity: 0.55,
            }}
          />
          <GoalDifferenceChart season={season} index={0} />
        </div>

        <DiagonalDivider />

        {/* ─────────────── ROW 3 — TOP SCORERS, EDITORIAL ─────────────── */}
        <ScorersHeading />
        <TopScorersSnapshot season={season} index={0} />

        <DiagonalDivider />

        {/* ─────────────── ROW 4 — MATCHES TIMELINE ─────────────── */}
        <SectionLabel
          index={3}
          eyebrow="Capítulo IV"
          title="Meccsről meccsre"
        />
        <MatchesTimeline season={season} index={0} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero
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
  const totalMatches =
    totals.wins + totals.draws + totals.losses;

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)]">
      {/* Layered atmospheric background — blaugrana + gold corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, rgba(165,0,68,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(0,77,152,0.32), transparent 55%), radial-gradient(circle at 80% 0%, rgba(196,163,77,0.10), transparent 40%)",
        }}
      />
      {/* Diagonal noise/highlight band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/50 to-transparent"
      />
      {/* Subtle vertical scan line on the right edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--accent-gold)]/20 to-transparent"
      />

      <div className="relative px-5 pb-10 pt-12 sm:px-10 sm:pb-14 sm:pt-16 lg:px-14 lg:pt-20">
        {/* Eyebrow row — season meta */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <span className="font-display text-[11px] uppercase tracking-[0.5em] text-[var(--accent-gold)]">
            Forca Barça
          </span>
          <span
            aria-hidden
            className="hidden h-px w-10 bg-[var(--accent-gold)]/40 sm:block"
          />
          <span className="font-display text-[11px] uppercase tracking-[0.4em] text-[var(--text-secondary)]">
            La Liga · Temporada {seasonLabel}
          </span>
        </motion.div>

        {/* Massive headline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.1,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className={cn(
            "mt-6 font-display leading-[0.92] tracking-wide",
            "text-[var(--text-primary)]",
            "text-[3.25rem] sm:text-7xl lg:text-[7.5rem]",
          )}
        >
          A teljes szezon{" "}
          <span className="block text-[var(--accent-gold)]">
            egy pillantásra
          </span>
        </motion.h1>

        {/* Editorial blurb + season picker on a magazine-style two-column row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
          className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-10"
        >
          <p className="lg:col-span-7 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Pontok, gólkülönbség, forma és gólkirályok — fordulóról fordulóra
            követjük az FCB szezonjának ívét. Görgess végig a vizuális
            összefoglalón, vagy válts másik szezonra.
          </p>

          <div className="lg:col-span-5 flex flex-col gap-3 lg:items-end">
            <span className="font-display text-[11px] uppercase tracking-[0.35em] text-[var(--text-muted)]">
              Szezon
            </span>
            <SeasonSelect
              value={season}
              options={SEASON_OPTIONS}
              onChange={onSeasonChange}
            />
          </div>
        </motion.div>

        {/* Three big snapshot stats — set into the hero for impact */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="mt-10 grid grid-cols-3 gap-3 sm:mt-14 sm:gap-8"
        >
          <HeroSnapshot
            label="Mérkőzés"
            value={totalMatches}
            loading={totalsLoading}
            tone="text-[var(--text-primary)]"
          />
          <HeroSnapshot
            label="Győzelem"
            value={totals.wins}
            loading={totalsLoading}
            tone="text-[var(--accent-gold)]"
          />
          <HeroSnapshot
            label="Gólarány"
            value={totals.goalsScored - totals.goalsConceded}
            loading={totalsLoading}
            tone="text-[#7aa6ff]"
            signed
          />
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-12 flex items-center gap-3 text-[var(--text-muted)] sm:mt-16"
        >
          <span className="h-px w-12 bg-[var(--text-muted)]/60" />
          <span className="font-display text-[10px] uppercase tracking-[0.4em]">
            Görgess tovább
          </span>
        </motion.div>
      </div>
    </section>
  );
}

interface HeroSnapshotProps {
  label: string;
  value: number;
  loading: boolean;
  tone: string;
  signed?: boolean;
}

function HeroSnapshot({
  label,
  value,
  loading,
  tone,
  signed = false,
}: HeroSnapshotProps) {
  const formatted = signed && value > 0 ? `+${value}` : String(value);
  return (
    <div className="flex flex-col">
      {loading ? (
        <span className="block h-[64px] w-20 animate-pulse rounded-md bg-[var(--glass-bg-hover)] sm:h-[96px] sm:w-28" />
      ) : (
        <span
          className={cn(
            "font-display leading-none tabular-nums",
            "text-[3.5rem] sm:text-[6rem] lg:text-[7rem]",
            tone,
          )}
        >
          {formatted}
        </span>
      )}
      <span className="mt-3 font-display text-[10px] uppercase tracking-[0.4em] text-[var(--text-secondary)] sm:text-[11px]">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section bits
// ---------------------------------------------------------------------------

interface SectionLabelProps {
  index: number;
  eyebrow: string;
  title: string;
}

function SectionLabel({ index, eyebrow, title }: SectionLabelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-5 mt-12 flex items-end gap-4 sm:mb-7 sm:mt-16"
    >
      <span className="font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
        {String(index).padStart(2, "0")} · {eyebrow}
      </span>
      <span
        aria-hidden
        className="mb-1 h-px flex-1 bg-gradient-to-r from-[var(--accent-gold)]/30 via-[var(--glass-border)] to-transparent"
      />
      <span className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
        {title}
      </span>
    </motion.div>
  );
}

function ScorersHeading() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mb-5 mt-12 sm:mb-7 sm:mt-16"
    >
      <div className="flex items-end gap-4">
        <span className="font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          03 · Goleadores
        </span>
        <span
          aria-hidden
          className="mb-1 h-px flex-1 bg-gradient-to-r from-[var(--accent-gold)]/30 via-[var(--glass-border)] to-transparent"
        />
      </div>
      <h2
        className={cn(
          "mt-3 font-display leading-[0.95] tracking-wide",
          "text-[var(--text-primary)]",
          "text-4xl sm:text-6xl lg:text-[5rem]",
        )}
      >
        Gólkirályok
      </h2>
      <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)]">
        Kik vitték a hátukon a támadást? A bajnokság gólszerző-rangsora,
        kiemelve a Barça játékosait.
      </p>
    </motion.div>
  );
}

/**
 * Editorial divider — diagonal blaugrana stripe with soft glow.
 * Pure CSS gradient, no extra animation work needed.
 */
function DiagonalDivider() {
  return (
    <div
      aria-hidden
      className="relative my-12 h-[2px] w-full overflow-visible sm:my-16"
    >
      <div
        className="h-full w-full opacity-50"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--accent-red) 25%, var(--accent-blue) 75%, transparent 100%)",
          transform: "skewX(-18deg)",
          filter: "drop-shadow(0 0 6px rgba(196,163,77,0.4))",
        }}
      />
    </div>
  );
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
// Suspense wrapper — required because we read useSearchParams() in the inner.
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
    <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:px-10">
      <div className="rounded-[var(--radius-lg)] bg-[var(--glass-bg-hover)] p-10 sm:p-14">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--glass-bg)]" />
        <div className="mt-6 h-20 w-3/4 animate-pulse rounded-md bg-[var(--glass-bg)] sm:h-32" />
        <div className="mt-4 h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg)]" />
      </div>
      <div className="mt-8 h-32 animate-pulse rounded-[var(--radius-lg)] bg-[var(--glass-bg-hover)] sm:mt-10" />
      <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-80 animate-pulse rounded-[var(--radius-lg)] bg-[var(--glass-bg-hover)]",
              i === 0 && "lg:col-span-2",
              i >= 2 && "lg:col-span-3",
            )}
          />
        ))}
      </div>
    </div>
  );
}
