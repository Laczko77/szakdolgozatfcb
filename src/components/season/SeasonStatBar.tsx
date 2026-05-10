"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * SeasonStatBar — full-width hero-stat strip for /season.
 *
 * 5 columns of large animated counters (W / D / L / Goals / Conceded).
 * Numbers animate from 0 → value via useMotionValue + useSpring once the
 * card scrolls into view, with `prefers-reduced-motion` snapping to the
 * final value. The component itself is presentational — the page hands
 * it the already-derived totals so it can be SSR-safe and deterministic.
 */

export interface SeasonStatBarProps {
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  /** Hides numeric content in favour of skeletons while team-form loads. */
  loading?: boolean;
  className?: string;
}

interface StatColumnData {
  label: string;
  sublabel: string;
  value: number;
  /** Tailwind color token for the number itself. */
  tone:
    | "text-[var(--accent-gold)]"
    | "text-[var(--text-muted)]"
    | "text-[#ff8aa6]"
    | "text-[#7aa6ff]";
  /** Subtle dot above the label, mirrors the tone. */
  dot: string;
}

export function SeasonStatBar({
  wins,
  draws,
  losses,
  goalsScored,
  goalsConceded,
  loading = false,
  className,
}: SeasonStatBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const columns: StatColumnData[] = [
    {
      label: "Győzelem",
      sublabel: "Victorias",
      value: wins,
      tone: "text-[var(--accent-gold)]",
      dot: "bg-[var(--accent-gold)]",
    },
    {
      label: "Döntetlen",
      sublabel: "Empates",
      value: draws,
      tone: "text-[var(--text-muted)]",
      dot: "bg-[var(--text-muted)]",
    },
    {
      label: "Vereség",
      sublabel: "Derrotas",
      value: losses,
      tone: "text-[#ff8aa6]",
      dot: "bg-[#ff8aa6]",
    },
    {
      label: "Lőtt gól",
      sublabel: "Goles a favor",
      value: goalsScored,
      tone: "text-[#7aa6ff]",
      dot: "bg-[#7aa6ff]",
    },
    {
      label: "Kapott gól",
      sublabel: "Goles en contra",
      value: goalsConceded,
      tone: "text-[var(--text-muted)]",
      dot: "bg-[var(--text-muted)]",
    },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "glass-card relative overflow-hidden",
        "px-4 py-7 sm:px-8 sm:py-10",
        className,
      )}
      aria-label="Szezon összesített statisztikái"
    >
      {/* Diagonal blaugrana wash — gives the bar its own atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "linear-gradient(115deg, rgba(165,0,68,0.10) 0%, transparent 35%, transparent 65%, rgba(0,77,152,0.12) 100%)",
        }}
      />
      {/* Top hairline + bottom hairline — gold accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/60 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/30 to-transparent"
      />

      <div className="relative">
        <p className="mb-6 font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Szezon · Összesítés
        </p>

        <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:flex lg:items-stretch lg:justify-between lg:gap-y-0">
          {columns.map((col, i) => (
            <div
              key={col.label}
              className={cn(
                "flex items-stretch",
                // Vertical separators only on lg+ between columns
                i > 0 && "lg:pl-6 xl:pl-10",
              )}
            >
              {i > 0 && (
                <div
                  aria-hidden
                  className="hidden lg:mr-6 lg:block xl:mr-10"
                >
                  <div className="h-full w-px bg-gradient-to-b from-transparent via-[var(--glass-border-hover)] to-transparent" />
                </div>
              )}
              <StatColumn
                label={col.label}
                sublabel={col.sublabel}
                value={col.value}
                tone={col.tone}
                dot={col.dot}
                trigger={inView}
                loading={loading}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stat column
// ---------------------------------------------------------------------------

interface StatColumnProps {
  label: string;
  sublabel: string;
  value: number;
  tone: string;
  dot: string;
  trigger: boolean;
  loading: boolean;
}

function StatColumn({
  label,
  sublabel,
  value,
  tone,
  dot,
  trigger,
  loading,
}: StatColumnProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start lg:items-center lg:text-center">
      <span
        aria-hidden
        className={cn(
          "mb-3 inline-block h-1.5 w-1.5 rounded-full",
          dot,
          "shadow-[0_0_8px_currentColor]",
        )}
      />
      {loading ? (
        <span className="block h-[64px] w-20 animate-pulse rounded-md bg-[var(--glass-bg-hover)] sm:h-[88px] sm:w-24" />
      ) : (
        <Counter
          value={value}
          trigger={trigger}
          className={cn(
            "block font-display leading-none tabular-nums",
            "text-[3.5rem] sm:text-[5rem] lg:text-[5.5rem] xl:text-[6rem]",
            tone,
          )}
        />
      )}
      <span className="mt-3 font-display text-[12px] uppercase tracking-[0.32em] text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
        {sublabel}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Counter primitive — useMotionValue + useSpring + useTransform
// ---------------------------------------------------------------------------

interface CounterProps {
  value: number;
  trigger: boolean;
  className?: string;
}

function Counter({ value, trigger, className }: CounterProps) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    stiffness: 80,
    damping: 22,
    mass: 0.6,
  });
  const rounded: MotionValue<string> = useTransform(spring, (latest) =>
    Math.round(latest).toString(),
  );
  const [display, setDisplay] = useState("0");

  // Drive the counter when the bar enters view (or immediately for reduced-motion).
  useEffect(() => {
    if (!trigger) return;
    if (reduced) {
      motionValue.jump(value);
      setDisplay(String(value));
      return;
    }
    motionValue.set(value);
  }, [trigger, value, reduced, motionValue]);

  // Subscribe the rounded transform back into React state so the DOM updates.
  useEffect(() => {
    const unsubscribe = rounded.on("change", (latest: string) => {
      setDisplay(latest);
    });
    return () => {
      unsubscribe();
    };
  }, [rounded]);

  return <span className={className}>{display}</span>;
}
