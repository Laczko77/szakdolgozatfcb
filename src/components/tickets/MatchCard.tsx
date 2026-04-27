"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { Match } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  deriveMatchStatus,
  MatchStatusBadge,
  type MatchStatusKind,
} from "./MatchStatusBadge";
import { TeamCrest } from "./TeamCrest";

interface MatchCardProps {
  match: Match;
  /** Drives the staggered grid reveal. */
  index?: number;
  /** Override the auto-derived status (useful when listing past matches). */
  status?: MatchStatusKind;
}

/**
 * Card rendered in the match-list grid.
 *
 * Layout:
 *  - Top row:  status pill + competition / venue meta on the right.
 *  - Middle:   stacked matchup ("FC Barcelona vs. Real Madrid") with the
 *              two team names broken across two display lines so the
 *              composition reads like a poster.
 *  - Bottom:   formatted kickoff date + "Részletek" CTA.
 *
 * Past matches are visually de-emphasised (lower opacity + no hover
 * animation) but still clickable so users can review their seats.
 */
export function MatchCard({ match, index = 0, status }: MatchCardProps) {
  const resolvedStatus = status ?? deriveMatchStatus(match.date);
  const isPast = resolvedStatus === "past";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.35),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <Link
        href={`/jegyek/${match.id}`}
        className={cn(
          "group block h-full",
          "glass-card",
          !isPast && "glass-card-hover",
          isPast && "opacity-75 hover:opacity-90",
          "relative overflow-hidden p-6 sm:p-7",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        {/* Decorative gradient stripe — gold/red/blue running on the right edge */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-0 top-0 h-full w-1",
            "bg-gradient-to-b from-[var(--accent-blue)] via-[var(--accent-gold)] to-[var(--accent-red)]",
            "opacity-40 transition-opacity duration-500",
            !isPast && "group-hover:opacity-90",
          )}
        />

        <div className="flex items-start justify-between gap-3">
          <MatchStatusBadge status={resolvedStatus} />
          {match.venue && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] uppercase",
                "tracking-[0.18em] text-[var(--text-muted)]",
              )}
            >
              <MapPin size={11} aria-hidden />
              <span className="max-w-[160px] truncate">{match.venue}</span>
            </span>
          )}
        </div>

        {/* Matchup — crest + name pairs, stacked with a vs. divider */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3">
            <TeamCrest
              url={match.home_team_crest}
              teamName={match.home_team}
              size={36}
            />
            <p
              className={cn(
                "min-w-0 truncate font-display text-2xl leading-[1.05] tracking-wide",
                "text-[var(--text-primary)] sm:text-3xl",
                "transition-colors duration-300",
                !isPast && "group-hover:text-[var(--accent-gold)]",
              )}
            >
              {match.home_team}
            </p>
          </div>

          <div className="flex items-center gap-2 pl-[14px]">
            <span aria-hidden className="h-px w-5 bg-[var(--glass-border)]" />
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--text-muted)]">
              vs.
            </p>
            <span aria-hidden className="h-px flex-1 bg-[var(--glass-border)]" />
          </div>

          <div className="flex items-center gap-3">
            <TeamCrest
              url={match.away_team_crest}
              teamName={match.away_team}
              size={36}
            />
            <p
              className={cn(
                "min-w-0 truncate font-display text-2xl leading-[1.05] tracking-wide",
                "text-[var(--text-primary)] sm:text-3xl",
              )}
            >
              {match.away_team}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-7 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <CalendarDays size={13} aria-hidden />
            <time dateTime={match.date}>{formatKickoff(match.date)}</time>
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium uppercase",
              "tracking-[0.22em] text-[var(--text-secondary)]",
              "transition-colors duration-300",
              !isPast && "group-hover:text-[var(--accent-gold)]",
            )}
          >
            {isPast ? "Eredmény" : "Részletek"}
            <ArrowUpRight
              size={14}
              className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/** "ápr. 30. csütörtök · 21:00" — compact card-friendly kickoff format. */
function formatKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("hu-HU", {
    month: "short",
    day: "numeric",
    weekday: "long",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${datePart} · ${timePart}`;
}
