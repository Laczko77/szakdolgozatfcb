"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, AlertTriangle, Goal, Square } from "lucide-react";
import {
  fetchMatchDetails,
  type MatchDetailsResponse,
  type MatchTeamStats,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";
import { ErrorBlock } from "./primitives";

interface MatchEventsPanelProps {
  matchId: number;
  /** Used to colour-code home vs away events. */
  fcbId: number;
}

/**
 * Inline event timeline rendered when a row in MatchesTimeline expands.
 *
 * Lazy-fetches the backend's `/api/season/match/[id]` endpoint and
 * branches on `data_quality`:
 *   - 'full'        → goals + bookings + substitutions
 *   - 'partial'     → whatever the API returned, headed by an inline note
 *   - 'unavailable' → "Részletes események nem elérhetők" + only the score
 */
export function MatchEventsPanel({ matchId, fcbId }: MatchEventsPanelProps) {
  const [data, setData] = useState<MatchDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      setErrorMessage(null);
      setData(null);
    });
    const controller = new AbortController();
    fetchMatchDetails(matchId, controller.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "A meccs részletei jelenleg nem elérhetők",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [matchId, retryNonce]);

  if (loading) return <EventsSkeleton />;

  if (errorMessage) {
    return (
      <ErrorBlock
        message={errorMessage}
        onRetry={() => setRetryNonce((n) => n + 1)}
      />
    );
  }

  if (!data) return null;

  const { events, data_quality } = data;
  const totalEvents =
    events.goals.length +
    events.bookings.length +
    events.substitutions.length;

  if (data_quality === "unavailable" || totalEvents === 0) {
    // Even when events are unavailable the team-stats payload may exist
    // — the api-football.com endpoints are independent — so render the
    // stats section above the fallback notice when we have it.
    return (
      <div className="space-y-4">
        {data.team_stats && (
          <TeamStatsSection
            stats={data.team_stats}
            homeTeam={data.match.homeTeam.name}
            awayTeam={data.match.awayTeam.name}
          />
        )}
        <div
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-md)]",
            "border border-dashed border-[var(--glass-border)]",
            "bg-[var(--glass-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]",
          )}
        >
          <AlertTriangle
            size={16}
            aria-hidden
            className="shrink-0 text-[var(--accent-gold)]"
          />
          <span>
            Részletes események nem elérhetők ehhez a meccshez. Csak a
            végeredményt tudjuk megjeleníteni.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.team_stats && (
        <TeamStatsSection
          stats={data.team_stats}
          homeTeam={data.match.homeTeam.name}
          awayTeam={data.match.awayTeam.name}
        />
      )}
      {data_quality === "partial" && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Részleges adat — egy vagy több eseménytípus hiányzik.
        </p>
      )}

      {events.goals.length > 0 && (
        <EventGroup
          title="Gólok"
          icon={<Goal size={14} aria-hidden />}
          accent="text-[var(--accent-gold)]"
        >
          {events.goals.map((g, i) => (
            <EventRow
              key={`goal-${i}`}
              minute={g.minute}
              isFcb={g.team.id === fcbId}
              icon="goal"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {g.scorer.name}
              </span>
              <span className="text-[var(--text-muted)]">{g.team.name}</span>
            </EventRow>
          ))}
        </EventGroup>
      )}

      {events.bookings.length > 0 && (
        <EventGroup
          title="Lapok"
          icon={<Square size={14} aria-hidden />}
          accent="text-amber-300"
        >
          {events.bookings.map((b, i) => (
            <EventRow
              key={`book-${i}`}
              minute={b.minute}
              isFcb={b.team.id === fcbId}
              icon={b.card === "RED" || b.card === "YELLOW_RED" ? "red" : "yellow"}
            >
              <span className="font-medium text-[var(--text-primary)]">
                {b.player.name}
              </span>
              <span className="text-[var(--text-muted)]">{b.team.name}</span>
            </EventRow>
          ))}
        </EventGroup>
      )}

      {events.substitutions.length > 0 && (
        <EventGroup
          title="Cserék"
          icon={<ArrowRightLeft size={14} aria-hidden />}
          accent="text-[var(--text-secondary)]"
        >
          {events.substitutions.map((s, i) => (
            <EventRow
              key={`sub-${i}`}
              minute={s.minute}
              isFcb={s.team.id === fcbId}
              icon="sub"
            >
              <span className="text-emerald-300">↑ {s.playerIn.name}</span>
              <span className="text-rose-300">↓ {s.playerOut.name}</span>
              <span className="text-[var(--text-muted)]">{s.team.name}</span>
            </EventRow>
          ))}
        </EventGroup>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EventGroup({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-2 inline-flex items-center gap-2",
          "font-display text-[11px] uppercase tracking-[0.25em]",
          accent,
        )}
      >
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function EventRow({
  minute,
  isFcb,
  icon,
  children,
}: {
  minute: number;
  isFcb: boolean;
  icon: "goal" | "yellow" | "red" | "sub";
  children: React.ReactNode;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: isFcb ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm",
        "border border-transparent",
        isFcb
          ? "bg-[var(--accent-gold)]/8 border-[var(--accent-gold)]/25"
          : "bg-[var(--glass-bg)]",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-9 shrink-0 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--bg-primary)]",
          "font-display text-[11px] tabular-nums text-[var(--text-secondary)]",
        )}
      >
        {minute}&apos;
      </span>
      <EventIcon kind={icon} />
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {children}
      </span>
    </motion.li>
  );
}

function EventIcon({ kind }: { kind: "goal" | "yellow" | "red" | "sub" }) {
  if (kind === "goal") {
    return (
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-gold)]/20 text-[var(--accent-gold)]"
      >
        ⚽
      </span>
    );
  }
  if (kind === "yellow") {
    return (
      <span
        aria-hidden
        className="block h-3.5 w-2.5 shrink-0 rounded-sm bg-amber-400"
      />
    );
  }
  if (kind === "red") {
    return (
      <span
        aria-hidden
        className="block h-3.5 w-2.5 shrink-0 rounded-sm bg-rose-500"
      />
    );
  }
  return (
    <ArrowRightLeft
      size={14}
      aria-hidden
      className="shrink-0 text-[var(--text-secondary)]"
    />
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-[var(--radius-md)] bg-[var(--glass-bg-hover)]"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team stats — possession bar + 5-row comparator grid
// ---------------------------------------------------------------------------

/**
 * Renders the api-football.com box-score for a finished match.
 *
 * Layout:
 *   - top: home / away team labels facing each other in small caps
 *   - middle: a single horizontal possession bar split at the home% mark.
 *     Home half uses --accent-blue (FCB's primary), away half uses a
 *     muted glass surface so the asymmetry reads as "us vs them" without
 *     fighting the rest of the dark palette.
 *   - bottom: 5-row mini-table — home value (right-aligned) | metric
 *     name (centred small caps) | away value (left-aligned).
 *
 * Every cell tolerates `null` (renders an em-dash) because the upstream
 * provider can drop individual metrics independently.
 */
function TeamStatsSection({
  stats,
  homeTeam,
  awayTeam,
}: {
  stats: MatchTeamStats;
  homeTeam: string;
  awayTeam: string;
}) {
  const homePoss = clampPercent(stats.home.possession);
  const awayPoss = clampPercent(stats.away.possession);
  // If both possession values are missing, hide the bar entirely rather
  // than rendering a centred 50/50 split that would look fake.
  const showPossessionBar = homePoss != null || awayPoss != null;
  const homeBarPct =
    homePoss != null
      ? homePoss
      : awayPoss != null
        ? Math.max(0, 100 - awayPoss)
        : 50;

  const rows: Array<{ label: string; home: number | null; away: number | null; suffix?: string }> = [
    { label: "Lövések", home: stats.home.shots, away: stats.away.shots },
    { label: "Kapura", home: stats.home.shots_on_target, away: stats.away.shots_on_target },
    { label: "Szögletek", home: stats.home.corners, away: stats.away.corners },
    { label: "Falták", home: stats.home.fouls, away: stats.away.fouls },
    {
      label: "Passz %",
      home: stats.home.pass_accuracy,
      away: stats.away.pass_accuracy,
      suffix: "%",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      aria-label={`${homeTeam} vs ${awayTeam} csapatstatisztikák`}
      className={cn(
        "rounded-xl border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] p-4 backdrop-blur",
      )}
    >
      {/* Team labels */}
      <header className="mb-4 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-[var(--text-secondary)]">
        <span className="min-w-0 truncate">{homeTeam}</span>
        <span className="font-display tracking-[0.32em] text-[var(--text-muted)]">
          Csapat statisztikák
        </span>
        <span className="min-w-0 truncate text-right">{awayTeam}</span>
      </header>

      {/* Possession bar */}
      {showPossessionBar && (
        <div className="mb-5">
          <div className="mb-1.5 flex items-center justify-between font-display text-xs tabular-nums text-[var(--text-primary)]">
            <span className="text-[var(--accent-blue)]">{formatPercent(homePoss)}</span>
            <span className="text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Labdabirtoklás
            </span>
            <span>{formatPercent(awayPoss)}</span>
          </div>
          <div
            role="img"
            aria-label={`Labdabirtoklás ${formatPercent(homePoss)} ${homeTeam} - ${formatPercent(awayPoss)} ${awayTeam}`}
            className={cn(
              "relative h-2 w-full overflow-hidden rounded-full",
              "border border-[var(--glass-border)] bg-[var(--glass-bg-hover)]",
            )}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${homeBarPct}%` }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute inset-y-0 left-0 bg-[var(--accent-blue)]"
              style={{
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            />
          </div>
        </div>
      )}

      {/* Comparator grid */}
      <ul className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <li
            key={row.label}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5"
          >
            <span
              className={cn(
                "text-right font-display text-base tabular-nums",
                row.home != null
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]",
              )}
            >
              {formatStat(row.home, row.suffix)}
            </span>
            <span className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-secondary)]">
              {row.label}
            </span>
            <span
              className={cn(
                "text-left font-display text-base tabular-nums",
                row.away != null
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]",
              )}
            >
              {formatStat(row.away, row.suffix)}
            </span>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

function clampPercent(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

function formatStat(value: number | null, suffix?: string): string {
  if (value == null) return "—";
  if (suffix === "%") return `${Math.round(value)}%`;
  return String(value);
}
