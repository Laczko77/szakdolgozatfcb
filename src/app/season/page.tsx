"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SeasonSelect, type SeasonOption } from "@/components/season/SeasonSelect";
import { PointsEvolutionChart } from "@/components/season/PointsEvolutionChart";
import { FormChips } from "@/components/season/FormChips";
import { GoalDifferenceChart } from "@/components/season/GoalDifferenceChart";
import { TopScorersSnapshot } from "@/components/season/TopScorersSnapshot";
import { MatchesTimeline } from "@/components/season/MatchesTimeline";
import { cn } from "@/lib/utils";

/**
 * /season — La Liga season story page (F31).
 *
 * Public, auth-not-required. Renders a long vertical document of charts
 * fed by the four `/api/season/...` endpoints introduced in BE Iter 27.
 *
 * Layout decisions:
 *  - Hero with the page title, an editorial blurb, and the season picker.
 *  - Single-page scroll (no tabs) — the page tells a coherent story so
 *    scrolling reads better than tab-switching, and Recharts' lazy
 *    animations time their reveals to the user's scroll naturally.
 *  - Two-column grid on desktop (lg+) for "Pontok evolúciója" + "Forma";
 *    every other section is full-width.
 *
 * State is mirrored into the URL via `?season=2025` so the picker is
 * shareable and the back button does the right thing.
 */

const SEASON_OPTIONS: ReadonlyArray<SeasonOption> = [
  { value: 2025, label: "2025/26" },
  { value: 2024, label: "2024/25" },
] as const;

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

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:px-10">
      {/* ─────────────── HERO ─────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mb-12 overflow-hidden rounded-[var(--radius-lg)] sm:mb-16"
      >
        {/* Decorative aura — pure CSS, runs always (cheap radial gradient). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(196,163,77,0.10), transparent 55%), radial-gradient(ellipse at bottom left, rgba(0,51,102,0.18), transparent 55%)",
          }}
        />

        <div className="flex flex-col gap-6 px-1 py-2 sm:px-2 sm:py-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
              <Sparkles size={12} aria-hidden />
              La Liga · {seasonLabel}
            </p>
            <h1
              className={cn(
                "mt-3 font-display leading-[0.95] tracking-wide",
                "text-[var(--text-primary)]",
                "text-[2.75rem] sm:text-[4.5rem] lg:text-[5.25rem]",
              )}
            >
              A teljes szezon
              <br />
              <span className="bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-gold)] to-[var(--accent-red)] bg-clip-text text-transparent">
                egy pillantásra.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
              Pontok, gólkülönbség, forma és gólkirályok — fordulóról fordulóra
              követjük az FCB szezonjának ívét. Görgess végig a vizuális
              összefoglalón, vagy válts másik szezonra.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-end">
            <span className="hidden font-display text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)] sm:inline">
              Szezon
            </span>
            <SeasonSelect
              value={season}
              options={SEASON_OPTIONS}
              onChange={handleSeasonChange}
            />
          </div>
        </div>
      </motion.header>

      {/* ─────────────── BODY GRID ─────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
        {/* Pont evolúció — full width on mobile, 1/2 on lg */}
        <PointsEvolutionChart
          season={season}
          index={0}
          className="lg:col-span-1"
        />

        {/* Forma chips — paired with pont evolúció on lg */}
        <FormChips
          season={season}
          index={1}
          className="lg:col-span-1"
        />

        {/* Gólkülönbség — full width */}
        <GoalDifferenceChart
          season={season}
          index={2}
          className="lg:col-span-2"
        />

        {/* Top gólszerzők — full width */}
        <TopScorersSnapshot
          season={season}
          index={3}
          className="lg:col-span-2"
        />

        {/* Meccsek timeline — full width */}
        <MatchesTimeline
          season={season}
          index={4}
          className="lg:col-span-2"
        />
      </div>
    </div>
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
      <div className="mb-12 space-y-4 sm:mb-16">
        <div className="h-3 w-40 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-20 w-3/4 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-80 animate-pulse rounded-[var(--radius-lg)] bg-[var(--glass-bg-hover)]",
              i >= 2 && "lg:col-span-2",
            )}
          />
        ))}
      </div>
    </div>
  );
}
