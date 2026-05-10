"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Target,
  Goal,
  PieChart,
  Trophy,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /api/team/statistics response shape — kept local to avoid pulling the
 * server-only `lib/api-football.ts` types into the client bundle.
 */
interface SofascoreTeamStatistics {
  goalsScored: number | null;
  goalsConceded: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  bigChances: number | null;
  successfulDribbles: number | null;
  totalPasses: number | null;
  accuratePassesPercentage: number | null;
  cleanSheets: number | null;
  tackles: number | null;
  interceptions: number | null;
  saves: number | null;
  duelsWon: number | null;
  avgRating: number | null;
}

interface TeamStatsResponse {
  statistics: SofascoreTeamStatistics;
  cached_at: string;
  season: number;
  tournament_id: number;
  stale?: boolean;
}

interface TeamStatsWidgetProps {
  /** Season starting year (e.g. 2024). */
  season: number;
  /** Sofascore tournament id — defaults to 8 (La Liga). */
  tournamentId?: number;
  index?: number;
  className?: string;
}

/**
 * "Csapat statisztikák" — 6-tile snapshot of FCB's season-aggregate
 * Sofascore numbers.
 *
 * Self-fetches `/api/team/statistics?season=YYYY&tournamentId=8`. The widget
 * gracefully hides on 404 / 503 so the page can render even when the
 * upstream provider isn't reachable. While loading, shows a skeleton row;
 * the parent's grid stays the same height so there's no layout jump.
 *
 * No tile is shown for a metric that came back `null` — Sofascore can drop
 * individual fields independently.
 */
export function TeamStatsWidget({
  season,
  tournamentId = 8,
  index = 0,
  className,
}: TeamStatsWidgetProps) {
  const [data, setData] = useState<TeamStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setHidden(false);
      setData(null);
    });

    const params = new URLSearchParams({
      season: String(season),
      tournamentId: String(tournamentId),
    });

    fetch(`/api/team/statistics?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          // 404, 503 → hide. Anything else (5xx) also hides — this widget is
          // strictly value-add, never blocking page render.
          setHidden(true);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as TeamStatsResponse;
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setHidden(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [season, tournamentId]);

  if (hidden) return null;

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
      aria-label="Csapat szezon-statisztikák"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />

      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Sofascore · Adatok
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-wide text-[var(--text-primary)] sm:text-[1.75rem]">
            Csapat statisztikák
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            Aggregált szezon-számok az aktuális La Liga kiírásból — a teljes
            keret együttes teljesítménye.
          </p>
        </div>
        {data?.stale && (
          <span
            className={cn(
              "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
              "px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--accent-red)]",
            )}
          >
            Cache
          </span>
        )}
      </header>

      {loading ? (
        <StatsSkeleton />
      ) : data ? (
        <StatsGrid stats={data.statistics} />
      ) : null}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Stats grid
// ---------------------------------------------------------------------------

interface TileSpec {
  key: keyof SofascoreTeamStatistics;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Optional formatter — defaults to `String(value)`. */
  format?: (value: number) => string;
  /** Tone class for the number (Tailwind). */
  tone?: string;
}

const TILES: TileSpec[] = [
  {
    key: "goalsScored",
    label: "Lőtt gólok",
    Icon: Goal,
    tone: "text-[var(--accent-gold)]",
  },
  {
    key: "goalsConceded",
    label: "Kapott gólok",
    Icon: ShieldCheck,
    tone: "text-[#ff8aa6]",
  },
  {
    key: "shotsOnTarget",
    label: "Lövés kapura",
    Icon: Target,
    tone: "text-[#7aa6ff]",
  },
  {
    key: "accuratePassesPercentage",
    label: "Passzpontosság",
    Icon: PieChart,
    format: (v) => `${Math.round(v)}%`,
    tone: "text-[var(--text-primary)]",
  },
  {
    key: "cleanSheets",
    label: "Kapott gól nélküli",
    Icon: Trophy,
    tone: "text-emerald-300",
  },
  {
    key: "avgRating",
    label: "Sofascore értékelés",
    Icon: Star,
    format: (v) => v.toFixed(2),
    tone: "text-[var(--accent-gold)]",
  },
];

function StatsGrid({ stats }: { stats: SofascoreTeamStatistics }) {
  // Drop tiles whose metric is missing — keeps the grid honest.
  const visible = TILES.filter((t) => stats[t.key] != null);

  if (visible.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        A szezon összesített statisztikái jelenleg nem elérhetők.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {visible.map((tile) => {
        const value = stats[tile.key] as number;
        const formatted = tile.format ? tile.format(value) : String(value);
        return (
          <li
            key={tile.key}
            className={cn(
              "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
              "bg-[var(--glass-bg)] p-4 transition-colors duration-200",
              "hover:border-[var(--accent-gold)]/35 hover:bg-[var(--glass-bg-hover)]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
                {tile.label}
              </span>
              <tile.Icon
                size={14}
                className="text-[var(--text-muted)]"
                aria-hidden
              />
            </div>
            <p
              className={cn(
                "mt-3 font-display text-3xl tabular-nums leading-none sm:text-4xl",
                tile.tone ?? "text-[var(--text-primary)]",
              )}
            >
              {formatted}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function StatsSkeleton() {
  return (
    <ul
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className={cn(
            "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
            "bg-[var(--glass-bg)] p-4",
          )}
        >
          <span className="block h-3 w-20 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <span
            className="mt-4 block h-9 w-16 animate-pulse rounded-md bg-[var(--glass-bg-hover)]"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        </li>
      ))}
    </ul>
  );
}
