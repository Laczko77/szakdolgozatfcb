"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, AlertCircle, Goal } from "lucide-react";
import { TeamCrest } from "@/components/tickets/TeamCrest";
import {
  fetchTopScorers,
  FOOTBALL_DATA_BARCELONA_NAME,
  type TopScorer,
} from "@/lib/football-stats-api";
import { cn } from "@/lib/utils";
import { WidgetShell } from "./WidgetShell";

interface TopScorersWidgetProps {
  index?: number;
  className?: string;
}

/**
 * "Góllövőlista" widget — top 5 La Liga scorers, expandable to top 10.
 *
 * Visual contract:
 *  - The goal count is the hero number on each row: rendered in
 *    Bebas Neue at display size, gold, with the assists value tucked
 *    underneath as a small "+N gólpassz" caption. This rhymes with the
 *    `PointsWidget` counter so the dashboard reads as a coherent set.
 *  - FC Barcelona scorers are matched by team *name* (the backend drops
 *    `team.id` for scorers — see lib/football-stats-api.ts), and get the
 *    same gold left-border + tinted background treatment as the FCB row
 *    in the standings widget.
 *  - "Top 10 mutatása" toggle reveals rows 6-10 with a Framer Motion
 *    height transition, mirroring the standings expand UX.
 */
export function TopScorersWidget({
  index = 0,
  className,
}: TopScorersWidgetProps) {
  const [scorers, setScorers] = useState<TopScorer[] | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchTopScorers({ limit: 10 }, controller.signal)
      .then((res) => {
        setScorers(res.scorers);
        setCachedAt(res.cached_at);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "A góllövőlista jelenleg nem elérhető",
        );
        setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  const top5 = scorers?.slice(0, 5) ?? [];
  const rest = scorers?.slice(5, 10) ?? [];
  const hasData = (scorers?.length ?? 0) > 0;
  const cachedLabel = cachedAt ? formatCacheAge(cachedAt) : null;

  return (
    <WidgetShell
      eyebrow="La Liga"
      title="Góllövőlista"
      meta={<LeagueBadge />}
      index={index}
      className={className}
    >
      {!loaded ? (
        <ScorersSkeleton />
      ) : errorMessage || !hasData ? (
        <ErrorState
          message={
            errorMessage ?? "A góllövőlista jelenleg nem elérhető"
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Top 5 */}
          <ul className="space-y-1.5">
            {top5.map((scorer, i) => (
              <ScorerRow
                key={`${scorer.player.id}-${i}`}
                scorer={scorer}
                position={i + 1}
              />
            ))}
          </ul>

          {/* Rows 6-10 */}
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
                <div
                  aria-hidden
                  className="my-2 h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent"
                />
                <ul className="space-y-1.5">
                  {rest.map((scorer, i) => (
                    <ScorerRow
                      key={`${scorer.player.id}-${i + 5}`}
                      scorer={scorer}
                      position={i + 6}
                    />
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle */}
          {rest.length > 0 && (
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
                <span>{expanded ? "Összecsukás" : "Top 10 mutatása"}</span>
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
          )}
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
      <Goal size={11} aria-hidden className="text-[var(--accent-gold)]" />
      LaLiga
    </span>
  );
}

function ScorerRow({
  scorer,
  position,
}: {
  scorer: TopScorer;
  position: number;
}) {
  // Backend doesn't expose team.id for scorers, so we fall back to the
  // canonical name. football-data.org is consistent here ("FC Barcelona"
  // verbatim) but we keep the comparison case-insensitive for safety.
  const isBarca =
    scorer.team.name.trim().toLowerCase() ===
    FOOTBALL_DATA_BARCELONA_NAME.toLowerCase();

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5",
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
          "w-6 shrink-0 text-center font-display text-base tabular-nums",
          isBarca
            ? "text-[var(--accent-gold)]"
            : position <= 3
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-secondary)]",
        )}
      >
        {position}
      </span>

      {/* Crest */}
      <TeamCrest
        url={scorer.team.crest}
        teamName={scorer.team.name}
        size={24}
      />

      {/* Name + team */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium leading-tight",
            isBarca
              ? "text-[var(--accent-gold)]"
              : "text-[var(--text-primary)]",
          )}
          title={scorer.player.name}
        >
          {scorer.player.name}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {scorer.team.name}
        </p>
      </div>

      {/* Stats — goal count is the hero, assists are a quiet caption. */}
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span
          className={cn(
            "font-display text-2xl leading-none tabular-nums",
            "text-[var(--accent-gold)]",
          )}
        >
          {scorer.goals}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          gól
        </span>
        {scorer.assists > 0 && (
          <span
            className={cn(
              "ml-2 text-[11px] tabular-nums text-[var(--text-secondary)]",
            )}
            title={`${scorer.assists} gólpassz`}
          >
            +{scorer.assists}A
          </span>
        )}
      </div>
    </li>
  );
}

function ScorersSkeleton() {
  return (
    <ul className="space-y-1.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="h-12 animate-pulse rounded-[var(--radius-md)] bg-[var(--glass-bg-hover)]"
        />
      ))}
    </ul>
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

/** "Frissítve X perce" — only renders when the cache is > 1 hour old. */
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
