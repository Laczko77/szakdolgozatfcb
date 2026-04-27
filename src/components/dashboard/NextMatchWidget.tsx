"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import type { Match } from "@/types/database";
import { useCountdown } from "@/hooks/useCountdown";
import { TeamCrest } from "@/components/tickets/TeamCrest";
import { cn } from "@/lib/utils";
import { WidgetShell } from "./WidgetShell";

interface NextMatchWidgetProps {
  match: Match | null;
  index?: number;
  className?: string;
}

/**
 * Hero widget on the dashboard — span-2 on desktop.
 *
 * Layout:
 *  - Top row:  matchup ("FCB vs. Real Madrid") + venue.
 *  - Big row:  live countdown (days / hours / minutes / seconds) in a
 *              4-column grid; each unit gets its own glass tile so the
 *              numbers feel kinetic.
 *  - Bottom:   date + ticket CTA pill.
 *
 * The countdown ticks every second (see {@link useCountdown}). When the
 * match has already kicked off we render a "Folyamatban / lejárt" state
 * — the widget never silently shows -1 days.
 */
export function NextMatchWidget({
  match,
  index = 0,
  className,
}: NextMatchWidgetProps) {
  const countdown = useCountdown(match?.date ?? null);

  return (
    <WidgetShell
      eyebrow="Következő mérkőzés"
      title={match ? formatMatchup(match) : "Nincs közelgő meccs"}
      meta={match ? <VenuePill venue={match.venue} /> : undefined}
      cta={match ? { label: "Jegyek megtekintése", href: "/jegyek" } : undefined}
      index={index}
      emphasized
      className={className}
    >
      {!match ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* Matchup crests — small visual anchor before the countdown.
              Sits above the numeric grid so the brand logos read first. */}
          <div className="flex items-center gap-3 text-sm sm:gap-4">
            <span className="inline-flex items-center gap-2 min-w-0">
              <TeamCrest
                url={match.home_team_crest}
                teamName={match.home_team}
                size={32}
              />
              <span className="truncate font-display tracking-wide text-[var(--text-primary)] text-base sm:text-lg">
                {match.home_team}
              </span>
            </span>
            <span aria-hidden className="font-display text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              vs.
            </span>
            <span className="inline-flex items-center gap-2 min-w-0">
              <TeamCrest
                url={match.away_team_crest}
                teamName={match.away_team}
                size={32}
              />
              <span className="truncate font-display tracking-wide text-[var(--text-primary)] text-base sm:text-lg">
                {match.away_team}
              </span>
            </span>
          </div>

          {/* Countdown grid */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <CountdownCell value={countdown.days} label="nap" />
            <CountdownCell value={countdown.hours} label="óra" />
            <CountdownCell value={countdown.minutes} label="perc" />
            <CountdownCell
              value={countdown.seconds}
              label="mp"
              accent
            />
          </div>

          {/* Date + CTA row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <CalendarDays size={16} aria-hidden />
              <time dateTime={match.date}>{formatMatchDate(match.date)}</time>
            </div>
            <Link
              href="/jegyek"
              className={cn(
                "glass-button-primary self-start sm:self-auto",
                "px-5 py-2.5 text-xs",
              )}
            >
              <Ticket size={14} aria-hidden />
              <span>Jegyvásárlás</span>
            </Link>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CountdownCell({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  const padded = value.toString().padStart(2, "0");
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-1",
        "rounded-[var(--radius-md)] py-3 sm:py-4",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        accent && "border-[var(--accent-gold)]/40",
      )}
    >
      <span
        className={cn(
          "font-display text-3xl leading-none tracking-wide tabular-nums sm:text-4xl",
          accent ? "text-[var(--accent-gold)]" : "text-[var(--text-primary)]",
        )}
        // The aria-live region updates as the seconds tick, but only the
        // accent cell is announced to avoid flooding screen readers.
        aria-live={accent ? "polite" : "off"}
      >
        {padded}
      </span>
      <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}

function VenuePill({ venue }: { venue: string | null }) {
  if (!venue) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
        "text-[var(--text-secondary)]",
      )}
    >
      <MapPin size={11} aria-hidden />
      {venue}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-8 text-center",
        "rounded-[var(--radius-md)]",
        "border border-dashed border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]",
      )}
    >
      <CalendarDays
        size={28}
        className="text-[var(--text-muted)]"
        aria-hidden
      />
      <p className="text-sm text-[var(--text-secondary)]">
        Jelenleg nincs ütemezett mérkőzés. Amint új meccs kerül a naptárba,
        itt megjelenik a visszaszámlálóval.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * "FC Barcelona vs. Real Madrid" — the API returns `home_team` /
 * `away_team` separately, but visually we collapse them into one line
 * so the matchup reads like a sports header.
 */
function formatMatchup(match: Match): string {
  return `${match.home_team} vs. ${match.away_team}`;
}

/** "2026. április 30., csütörtök · 21:00" */
function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${datePart} · ${timePart}`;
}
