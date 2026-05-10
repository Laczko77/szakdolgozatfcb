"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  fetchTeamForm,
  FCB_TEAM_ID,
  type FormMatch,
  type TeamFormResponse,
} from "@/lib/season-api";
import { TeamCrest } from "@/components/tickets/TeamCrest";
import { cn } from "@/lib/utils";
import { ChartShell } from "./ChartShell";
import {
  CacheLabel,
  ChartSkeleton,
  EmptyBlock,
  ErrorBlock,
} from "./primitives";
import { MatchEventsPanel } from "./MatchEventsPanel";

interface MatchesTimelineProps {
  season: number;
  index?: number;
  className?: string;
}

/**
 * "Meccsek" — chronological list of FC Barcelona's La Liga matches across
 * the whole selected season.
 *
 * Data source:
 *  `/api/season/team-form?limit=50` — the backend serves the entire
 *  finished-fixture list for the season (capped at 60 server-side, well
 *  above La Liga's 38 rounds). The dashboard's "next match" widget keeps
 *  using the default `limit=10` slice of the same cache row.
 *
 * Behaviour:
 *  - Each row is a compact horizontal strip (date, crests, score,
 *    matchday). Tapping toggles an inline expand panel with goals /
 *    bookings / substitutions, fetched on demand.
 *  - The list itself only mounts the panel when the row is opened;
 *    the entire timeline is wrapped in an IntersectionObserver so we
 *    don't even fire the team-form request until the user scrolls
 *    near the section.
 *  - FCB rows are highlighted regardless of result (this is a Barça
 *    portal — every row is FCB), with a gold left-edge accent.
 */
const SEASON_FETCH_LIMIT = 50;
export function MatchesTimeline({
  season,
  index = 0,
  className,
}: MatchesTimelineProps) {
  const reduced = useReducedMotion();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(false);

  const [data, setData] = useState<TeamFormResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ---------------- IntersectionObserver lazy-mount ----------------
  useEffect(() => {
    if (activated) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // SSR / very old browser fallback: just activate immediately.
      setActivated(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActivated(true);
            obs.disconnect();
            return;
          }
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [activated]);

  // ---------------- Fetch (only after activation) ----------------
  useEffect(() => {
    if (!activated) return;
    queueMicrotask(() => {
      setLoaded(false);
      setErrorMessage(null);
      setData(null);
    });
    const controller = new AbortController();
    fetchTeamForm({ season, limit: SEASON_FETCH_LIMIT }, controller.signal)
      .then((res) => {
        setData(res);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "A meccslista jelenleg nem elérhető",
        );
        setLoaded(true);
      });
    return () => controller.abort();
  }, [activated, season, retryNonce]);

  // Render newest → oldest (the API already returns descending by date).
  const matches = useMemo<FormMatch[]>(() => data?.matches ?? [], [data]);

  return (
    <div ref={sentinelRef}>
      <ChartShell
        eyebrow="Meccsek"
        title="A teljes La Liga szezon meccsei"
        description={
          matches.length > 0
            ? `${matches.length} lejátszott bajnoki — kattints egy sorra a részletes események megjelenítéséhez.`
            : "Az aktuális szezon összes lejátszott meccse — kattints egy sorra a részletes események megjelenítéséhez."
        }
        meta={<CacheLabel cachedAt={data?.cached_at} stale={data?.stale} />}
        index={index}
        className={className}
      >
        {!activated || !loaded ? (
          <ChartSkeleton height={420} withAxis={false} />
        ) : errorMessage ? (
          <ErrorBlock
            message={errorMessage}
            onRetry={() => setRetryNonce((n) => n + 1)}
          />
        ) : matches.length === 0 ? (
          <EmptyBlock message="Még nincsenek lejátszott bajnoki meccsek." />
        ) : (
          <ol className="space-y-2">
            {matches.map((m, i) => (
              <MatchRow
                key={m.match_id}
                match={m}
                expanded={expandedId === m.match_id}
                onToggle={() =>
                  setExpandedId((id) => (id === m.match_id ? null : m.match_id))
                }
                index={i}
                reduced={reduced}
              />
            ))}
          </ol>
        )}
      </ChartShell>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match row
// ---------------------------------------------------------------------------

interface MatchRowProps {
  match: FormMatch;
  expanded: boolean;
  onToggle: () => void;
  index: number;
  reduced: boolean;
}

function MatchRow({ match, expanded, onToggle, index, reduced }: MatchRowProps) {
  const isFcbHome = match.homeTeam.id === FCB_TEAM_ID;
  const fcbScore = isFcbHome ? match.score.home : match.score.away;
  const oppScore = isFcbHome ? match.score.away : match.score.home;
  const resultTone =
    match.result === "W"
      ? "text-emerald-300 border-emerald-400/40"
      : match.result === "D"
        ? "text-amber-300 border-amber-400/40"
        : "text-rose-300 border-rose-400/40";

  return (
    <li>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{
          duration: 0.4,
          delay: reduced ? 0 : Math.min(index * 0.04, 0.3),
        }}
        className={cn(
          "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
          "bg-[var(--glass-bg)] transition-colors duration-200",
          "shadow-[inset_3px_0_0_var(--accent-gold)]",
          expanded
            ? "border-[var(--accent-gold)]/40 bg-[var(--glass-bg-hover)]"
            : "hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`match-events-${match.match_id}`}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-3 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
            "rounded-[var(--radius-md)]",
          )}
        >
          {/* Date */}
          <span className="hidden w-20 shrink-0 font-display text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)] sm:block">
            {formatShortDate(match.utcDate)}
          </span>

          {/* Home */}
          <span
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2",
              "justify-end text-right",
            )}
          >
            <span
              className={cn(
                "truncate text-sm font-medium",
                match.homeTeam.id === FCB_TEAM_ID
                  ? "text-[var(--accent-gold)]"
                  : "text-[var(--text-primary)]",
              )}
              title={match.homeTeam.name}
            >
              {match.homeTeam.name}
            </span>
            <TeamCrest
              url={null}
              teamName={match.homeTeam.name}
              size={28}
            />
          </span>

          {/* Score */}
          <span
            className={cn(
              "flex shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 py-1",
              "font-display text-lg tabular-nums tracking-wide",
              resultTone,
              "bg-[var(--bg-primary)]/40",
            )}
          >
            <span>{match.score.home}</span>
            <span className="text-[var(--text-muted)]">–</span>
            <span>{match.score.away}</span>
          </span>

          {/* Away */}
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <TeamCrest
              url={null}
              teamName={match.awayTeam.name}
              size={28}
            />
            <span
              className={cn(
                "truncate text-sm font-medium",
                match.awayTeam.id === FCB_TEAM_ID
                  ? "text-[var(--accent-gold)]"
                  : "text-[var(--text-primary)]",
              )}
              title={match.awayTeam.name}
            >
              {match.awayTeam.name}
            </span>
          </span>

          {/* Matchday + chevron */}
          <span className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="font-display text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
              {match.matchday ? `${match.matchday}. ford.` : "—"}
            </span>
            <ChevronDown
              size={16}
              aria-hidden
              className={cn(
                "text-[var(--text-secondary)] transition-transform duration-300",
                expanded && "rotate-180 text-[var(--accent-gold)]",
              )}
            />
          </span>
        </button>

        {/* Mobile-only meta strip below the button (date + matchday) */}
        <div className="-mt-1 flex items-center justify-between px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] sm:hidden">
          <span>{formatShortDate(match.utcDate)}</span>
          <span>
            {match.matchday ? `${match.matchday}. ford.` : ""}{" "}
            <span className="ml-2 inline-block align-middle">
              <ChevronDown
                size={14}
                aria-hidden
                className={cn(
                  "transition-transform duration-300 inline-block",
                  expanded && "rotate-180 text-[var(--accent-gold)]",
                )}
              />
            </span>
          </span>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              id={`match-events-${match.match_id}`}
              key="panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="overflow-hidden"
            >
              <div
                aria-hidden
                className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent"
              />
              <div className="px-3 pb-4 pt-2">
                <MatchScoreSummary
                  isFcbHome={isFcbHome}
                  fcbScore={fcbScore}
                  oppScore={oppScore}
                />
                <div className="mt-4">
                  <MatchEventsPanel
                    matchId={match.match_id}
                    fcbId={FCB_TEAM_ID}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </li>
  );
}

function MatchScoreSummary({
  isFcbHome,
  fcbScore,
  oppScore,
}: {
  isFcbHome: boolean;
  fcbScore: number;
  oppScore: number;
}) {
  return (
    <p className="text-xs text-[var(--text-secondary)]">
      <span className="font-display tracking-[0.2em] text-[var(--accent-gold)]">
        {isFcbHome ? "Hazai" : "Idegen"}
      </span>{" "}
      meccs ·{" "}
      <span className="font-medium text-[var(--text-primary)]">
        FCB {fcbScore} – {oppScore} ellenfél
      </span>
    </p>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("hu-HU", {
    month: "short",
    day: "2-digit",
  });
}
