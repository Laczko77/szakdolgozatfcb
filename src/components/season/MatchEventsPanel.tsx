"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  AlertTriangle,
  Goal,
  Square,
  Tv,
} from "lucide-react";
import {
  fetchMatchDetails,
  type MatchDetailsResponse,
  type MatchTeamStats,
  type SofascoreIncident,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";
import { ErrorBlock } from "./primitives";
import { LineupsPanel } from "./LineupsPanel";
import { ShotmapPanel } from "./ShotmapPanel";
import { MomentumChart } from "./MomentumChart";
import { BestPlayersBar } from "./BestPlayersBar";

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

  // Sofascore extras — each may be `null` / empty independently of the
  // others, so every panel below decides on its own whether to render.
  const lineups = data.lineups;
  const incidents = data.incidents ?? [];
  const shotmap = data.shotmap ?? [];
  const graph = data.graph ?? [];
  const bestPlayers = data.best_players;
  const isFinal = data.match.status === "FT" || data.match.status === "FINISHED";

  // Decide whether to use Sofascore incidents as the primary timeline.
  // We only swap out the football-data goals/bookings/substitutions block
  // when the incident stream actually contains a goal — otherwise we keep
  // both, with incidents leading, so we never silently drop scoring info.
  const incidentsHaveGoal = incidents.some((i) => i.type === "goal");
  const useIncidentsAsPrimary = incidentsHaveGoal;

  const homeTeamName = data.match.homeTeam.name;
  const awayTeamName = data.match.awayTeam.name;

  if (data_quality === "unavailable" || totalEvents === 0) {
    // Even when football-data events are unavailable, Sofascore extras
    // may still be present — render whichever panels we have, then fall
    // through to the friendly notice if we have nothing else either.
    const hasAnyExtras =
      data.team_stats ||
      (lineups && (lineups.home.length > 0 || lineups.away.length > 0)) ||
      shotmap.length > 0 ||
      graph.length > 0 ||
      (bestPlayers && (bestPlayers.home || bestPlayers.away)) ||
      incidents.length > 0;

    if (!hasAnyExtras) {
      return (
        <div className="space-y-4">
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
    // fall through to the rich-render branch — extras carry the panel.
  }

  return (
    <div className="space-y-4">
      {/* 1. Best players (FT only — pre-match the rating doesn't exist) */}
      {isFinal && (
        <BestPlayersBar
          bestPlayers={bestPlayers}
          homeTeam={homeTeamName}
          awayTeam={awayTeamName}
          index={0}
        />
      )}

      {/* 2. Team stats (existing) */}
      {data.team_stats && (
        <TeamStatsSection
          stats={data.team_stats}
          homeTeam={homeTeamName}
          awayTeam={awayTeamName}
        />
      )}

      {/* 3. Lineups */}
      <LineupsPanel
        lineups={lineups}
        homeTeam={homeTeamName}
        awayTeam={awayTeamName}
        index={1}
      />

      {/* 4. Momentum */}
      <MomentumChart
        graph={graph}
        homeTeam={homeTeamName}
        awayTeam={awayTeamName}
        index={2}
      />

      {/* 5. Shotmap */}
      <ShotmapPanel
        shotmap={shotmap}
        homeTeam={homeTeamName}
        awayTeam={awayTeamName}
        index={3}
      />

      {data_quality === "partial" && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Részleges adat — egy vagy több eseménytípus hiányzik.
        </p>
      )}

      {/* 6. Incidents (Sofascore) — placed BEFORE football-data events when
          the stream contains a goal so it reads as the canonical timeline. */}
      {useIncidentsAsPrimary && incidents.length > 0 && (
        <IncidentsTimeline
          incidents={incidents}
          homeTeam={homeTeamName}
          awayTeam={awayTeamName}
        />
      )}

      {/* 7. football-data.org events (goals / bookings / substitutions). We
          keep these visible alongside the incident timeline because each
          source occasionally drops a row the other captures. */}
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

      {/* If we did NOT promote incidents above, render them below as a
          supplementary "Sofascore eseménysor" so VAR/period markers still
          land somewhere on the panel. */}
      {!useIncidentsAsPrimary && incidents.length > 0 && (
        <IncidentsTimeline
          incidents={incidents}
          homeTeam={homeTeamName}
          awayTeam={awayTeamName}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sofascore incidents timeline
// ---------------------------------------------------------------------------

/**
 * Render the Sofascore incident stream as a single chronological list.
 *
 * Goals carry the running scoreline; cards show the colour; subs use the
 * up/down arrow convention; VAR rows pin a leading TV icon and use the
 * `description` payload as the headline. `period` markers (HT, FT, ET,
 * pen) become full-width gold-tinted dividers so the half-time break and
 * extra-time periods read as section breaks rather than ordinary rows.
 */
function IncidentsTimeline({
  incidents,
  homeTeam,
  awayTeam,
}: {
  incidents: SofascoreIncident[];
  homeTeam: string;
  awayTeam: string;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-2 inline-flex items-center gap-2",
          "font-display text-[11px] uppercase tracking-[0.25em]",
          "text-[var(--accent-gold)]",
        )}
      >
        Sofascore eseménysor
      </p>
      <ul className="space-y-1.5">
        {incidents.map((inc, i) => {
          if (inc.type === "period") {
            return (
              <li key={`p-${i}`} className="py-1.5">
                <div
                  aria-hidden
                  className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]"
                >
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--accent-gold)]/40" />
                  <span>{inc.description ?? "Szakasz"}</span>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--accent-gold)]/40" />
                </div>
              </li>
            );
          }
          return (
            <IncidentRow
              key={`i-${i}`}
              incident={inc}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          );
        })}
      </ul>
    </div>
  );
}

function IncidentRow({
  incident,
  homeTeam,
  awayTeam,
}: {
  incident: SofascoreIncident;
  homeTeam: string;
  awayTeam: string;
}) {
  const teamLabel =
    incident.isHome === true
      ? homeTeam
      : incident.isHome === false
        ? awayTeam
        : null;
  const minuteLabel =
    incident.addedTime != null && incident.addedTime > 0
      ? `${incident.time}+${incident.addedTime}'`
      : `${incident.time}'`;

  let icon: React.ReactNode = null;
  let body: React.ReactNode = null;

  if (incident.type === "goal") {
    icon = (
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-gold)]/20 text-[var(--accent-gold)]"
      >
        ⚽
      </span>
    );
    body = (
      <>
        <span className="font-medium text-[var(--text-primary)]">
          {incident.playerName ?? "Ismeretlen"}
        </span>
        {incident.goalType && (
          <span className="text-[var(--text-muted)]">
            ({translateGoalType(incident.goalType)})
          </span>
        )}
        {incident.homeScore != null && incident.awayScore != null && (
          <span
            className={cn(
              "rounded-[var(--radius-sm)] border border-[var(--accent-gold)]/40",
              "bg-[var(--accent-gold)]/10 px-2 py-0.5",
              "font-display text-xs tabular-nums text-[var(--accent-gold)]",
            )}
          >
            {incident.homeScore}-{incident.awayScore}
          </span>
        )}
        {teamLabel && (
          <span className="text-[var(--text-muted)]">{teamLabel}</span>
        )}
      </>
    );
  } else if (incident.type === "card") {
    const isRed =
      incident.cardType === "red" || incident.cardType === "yellowRed";
    icon = (
      <span
        aria-hidden
        className={cn(
          "block h-3.5 w-2.5 shrink-0 rounded-sm",
          isRed ? "bg-rose-500" : "bg-amber-400",
        )}
      />
    );
    body = (
      <>
        <span className="font-medium text-[var(--text-primary)]">
          {incident.playerName ?? "Ismeretlen"}
        </span>
        <span className="text-[var(--text-muted)]">
          {isRed ? "Piros lap" : "Sárga lap"}
        </span>
        {teamLabel && (
          <span className="text-[var(--text-muted)]">{teamLabel}</span>
        )}
      </>
    );
  } else if (incident.type === "substitution") {
    icon = (
      <ArrowRightLeft
        size={14}
        aria-hidden
        className="shrink-0 text-[var(--text-secondary)]"
      />
    );
    body = (
      <>
        {incident.playerInName && (
          <span className="text-emerald-300">
            ↑ {incident.playerInName}
          </span>
        )}
        {incident.playerOutName && (
          <span className="text-rose-300">↓ {incident.playerOutName}</span>
        )}
        {teamLabel && (
          <span className="text-[var(--text-muted)]">{teamLabel}</span>
        )}
      </>
    );
  } else if (incident.type === "varDecision") {
    icon = (
      <Tv
        size={14}
        aria-hidden
        className="shrink-0 text-[var(--accent-blue)]"
      />
    );
    body = (
      <>
        <span className="font-medium text-[var(--text-primary)]">VAR</span>
        {incident.description && (
          <span className="text-[var(--text-secondary)]">
            {incident.description}
          </span>
        )}
        {incident.playerName && (
          <span className="text-[var(--text-muted)]">
            {incident.playerName}
          </span>
        )}
      </>
    );
  } else {
    // Unknown / untyped incident — render whatever description we have.
    icon = (
      <span
        aria-hidden
        className="block h-2 w-2 shrink-0 rounded-full bg-[var(--text-muted)]"
      />
    );
    body = (
      <>
        <span className="text-[var(--text-secondary)]">
          {incident.description ?? incident.type}
        </span>
        {incident.playerName && (
          <span className="text-[var(--text-muted)]">
            {incident.playerName}
          </span>
        )}
      </>
    );
  }

  return (
    <motion.li
      initial={{ opacity: 0, x: incident.isHome ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm",
        "border border-transparent",
        "bg-[var(--glass-bg)]",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-9 shrink-0 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--bg-primary)]",
          "font-display text-[11px] tabular-nums text-[var(--text-secondary)]",
        )}
      >
        {minuteLabel}
      </span>
      {icon}
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {body}
      </span>
    </motion.li>
  );
}

function translateGoalType(goalType: string): string {
  switch (goalType) {
    case "regular":
      return "rendes játékidő";
    case "penalty":
      return "tizenegyes";
    case "owngoal":
      return "öngól";
    case "header":
      return "fejes";
    case "freekick":
      return "szabadrúgás";
    default:
      return goalType;
  }
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
