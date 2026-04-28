"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Trophy, AlertCircle } from "lucide-react";
import { TeamCrest } from "@/components/tickets/TeamCrest";
import {
  fetchStandings,
  FOOTBALL_DATA_BARCELONA_ID,
  type StandingsRow,
} from "@/lib/football-stats-api";
import { cn } from "@/lib/utils";
import { WidgetShell } from "./WidgetShell";

interface StandingsWidgetProps {
  index?: number;
  className?: string;
}

/**
 * "La Liga állás" widget — top-5 mini-table by default, expandable to the
 * full 20-team standings via Framer Motion `AnimatePresence`.
 *
 * Visual contract:
 *  - Compact column header strip ("P / Gy / D / V / Pt") that lets the
 *    table breathe in a 4-column-wide widget without truncating.
 *  - FC Barcelona row gets a permanent gold left-border accent and a
 *    subtle gold-tinted background, regardless of position. This is the
 *    one row a Barça-fan dashboard must never miss.
 *  - "Teljes tabella" toggle expands rows 6-20 with a height/opacity
 *    transition. `prefers-reduced-motion` short-circuits the height
 *    animation globally (see globals.css).
 *
 * The widget owns its own data fetch — keeping it co-located with the
 * component means future relocations (e.g. moving to `/jegyek`) work
 * without touching the dashboard page wiring.
 */
export function StandingsWidget({ index = 0, className }: StandingsWidgetProps) {
  const [standings, setStandings] = useState<StandingsRow[] | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchStandings({}, controller.signal)
      .then((res) => {
        setStandings(res.standings);
        setCachedAt(res.cached_at);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Az állás jelenleg nem elérhető",
        );
        setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  const top5 = standings?.slice(0, 5) ?? [];
  const rest = standings?.slice(5, 20) ?? [];
  const hasData = (standings?.length ?? 0) > 0;
  const cachedLabel = cachedAt ? formatCacheAge(cachedAt) : null;

  return (
    <WidgetShell
      eyebrow="La Liga"
      title="Állás"
      meta={<LeagueBadge />}
      index={index}
      className={className}
    >
      {!loaded ? (
        <StandingsRowsSkeleton />
      ) : errorMessage || !hasData ? (
        <ErrorState message={errorMessage ?? "Az állás jelenleg nem elérhető"} />
      ) : (
        <div className="space-y-3">
          {/* Column header — abbreviated so all five fit on a 4-col grid. */}
          <ColumnHeader />

          {/* Top 5 rows */}
          <ul className="space-y-1.5">
            {top5.map((row) => (
              <StandingsRowItem key={row.team.id} row={row} />
            ))}
          </ul>

          {/* Expandable rows 6-20 */}
          <AnimatePresence initial={false}>
            {expanded && rest.length > 0 && (
              <motion.div
                key="rest"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="overflow-hidden"
              >
                {/* Visual divider between top 5 and the rest. */}
                <div
                  aria-hidden
                  className="my-2 h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent"
                />
                <ul className="space-y-1.5">
                  {rest.map((row) => (
                    <StandingsRowItem key={row.team.id} row={row} />
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={cn(
                "inline-flex items-center gap-1.5",
                "text-sm font-medium text-[var(--text-secondary)]",
                "transition-colors duration-200 hover:text-[var(--accent-gold)]",
                "focus-visible:outline-none focus-visible:text-[var(--accent-gold)]",
              )}
            >
              <span>{expanded ? "Összecsukás" : "Teljes tabella"}</span>
              <ChevronDown
                size={14}
                aria-hidden
                className={cn(
                  "transition-transform duration-300",
                  expanded && "rotate-180",
                )}
              />
            </button>
            {cachedLabel && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {cachedLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LeagueBadge() {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
        "text-[var(--text-secondary)]",
      )}
    >
      <Trophy size={11} aria-hidden className="text-[var(--accent-gold)]" />
      LaLiga
    </span>
  );
}

function ColumnHeader() {
  return (
    <div
      className={cn(
        "grid items-center gap-2 px-3 py-1.5",
        "grid-cols-[28px_minmax(0,1fr)_repeat(5,28px)] sm:grid-cols-[28px_minmax(0,1fr)_repeat(5,32px)]",
        "text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]",
      )}
      aria-hidden
    >
      <span className="text-center">#</span>
      <span>Csapat</span>
      <span className="text-center" title="Játszott">
        L
      </span>
      <span className="text-center" title="Győzelem">
        Gy
      </span>
      <span className="text-center" title="Döntetlen">
        D
      </span>
      <span className="text-center" title="Vereség">
        V
      </span>
      <span className="text-center font-bold tracking-[0.2em] text-[var(--accent-gold)]">
        Pt
      </span>
    </div>
  );
}

function StandingsRowItem({ row }: { row: StandingsRow }) {
  const isBarca = row.team.id === FOOTBALL_DATA_BARCELONA_ID;
  return (
    <li
      className={cn(
        "grid items-center gap-2 rounded-[var(--radius-md)] px-3 py-2",
        "grid-cols-[28px_minmax(0,1fr)_repeat(5,28px)] sm:grid-cols-[28px_minmax(0,1fr)_repeat(5,32px)]",
        "border border-transparent transition-colors duration-200",
        "hover:bg-[var(--glass-bg-hover)]",
        isBarca && [
          "border-[var(--accent-gold)]/30 bg-[var(--accent-gold)]/8",
          "shadow-[inset_3px_0_0_var(--accent-gold)]",
        ],
      )}
      aria-current={isBarca ? "true" : undefined}
    >
      {/* Position */}
      <span
        className={cn(
          "text-center font-display text-base tabular-nums",
          isBarca
            ? "text-[var(--accent-gold)]"
            : row.position <= 4
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-secondary)]",
        )}
      >
        {row.position}
      </span>

      {/* Team identity */}
      <span className="flex min-w-0 items-center gap-2">
        <TeamCrest url={row.team.crest} teamName={row.team.name} size={20} />
        <span
          className={cn(
            "truncate text-sm font-medium",
            isBarca
              ? "text-[var(--accent-gold)]"
              : "text-[var(--text-primary)]",
          )}
          title={row.team.name}
        >
          {row.team.name}
        </span>
      </span>

      {/* Stat columns */}
      <Stat value={row.playedGames} />
      <Stat value={row.won} />
      <Stat value={row.draw} />
      <Stat value={row.lost} />
      <Stat
        value={row.points}
        emphasised
        className={isBarca ? "text-[var(--accent-gold)]" : undefined}
      />
    </li>
  );
}

function Stat({
  value,
  emphasised = false,
  className,
}: {
  value: number;
  emphasised?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-center text-xs tabular-nums",
        emphasised
          ? "font-display text-base font-semibold text-[var(--text-primary)]"
          : "text-[var(--text-secondary)]",
        className,
      )}
    >
      {value}
    </span>
  );
}

function StandingsRowsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      <div className="space-y-1.5 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-[var(--radius-md)] bg-[var(--glass-bg-hover)]"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-6 text-center",
        "rounded-[var(--radius-md)]",
        "border border-dashed border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]",
      )}
    >
      <AlertCircle
        size={22}
        className="text-[var(--text-muted)]"
        aria-hidden
      />
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}

/**
 * "Frissítve X perce" label, only rendered when the cache row is older
 * than 1 hour — surfaces the stale-while-error path the backend uses
 * when football-data.org is rate-limited or unreachable.
 */
function formatCacheAge(iso: string): string | null {
  const cachedAt = new Date(iso).getTime();
  if (Number.isNaN(cachedAt)) return null;
  const ageMs = Date.now() - cachedAt;
  const oneHour = 60 * 60 * 1000;
  if (ageMs < oneHour) return null;
  const hours = Math.floor(ageMs / oneHour);
  if (hours < 24) return `Frissítve ${hours} órája`;
  const days = Math.floor(hours / 24);
  return `Frissítve ${days} napja`;
}
