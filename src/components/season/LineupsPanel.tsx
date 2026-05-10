"use client";

import { motion } from "framer-motion";
import type {
  SofascoreLineupPlayer,
  SofascoreLineupsPayload,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";

interface LineupsPanelProps {
  lineups: SofascoreLineupsPayload | null;
  homeTeam: string;
  awayTeam: string;
  /** football-data.org id for the team we want to highlight in gold. */
  fcbName?: string;
  index?: number;
}

/**
 * Two-column starting XI + substitutes panel sourced from Sofascore.
 *
 * Layout:
 *   - centred header: home formation badge ←vs→ away formation badge
 *   - desktop: home column on the left, away on the right
 *   - mobile (< sm): stacked — home on top, away below
 *
 * Each player row renders the jersey number, name (gold if it's an FCB
 * player), a coloured position pill, the Sofascore match rating (when
 * available) and trailing icons for goals / assists / cards.
 *
 * Substitutes are rendered in a smaller, muted "Cserepad" sub-section
 * separated by a gold-tinted hairline.
 */
export function LineupsPanel({
  lineups,
  homeTeam,
  awayTeam,
  fcbName = "FC Barcelona",
  index = 0,
}: LineupsPanelProps) {
  if (!lineups) return null;
  if (lineups.home.length === 0 && lineups.away.length === 0) return null;

  const homeStarters = lineups.home.filter((p) => !p.substitute);
  const homeBench = lineups.home.filter((p) => p.substitute);
  const awayStarters = lineups.away.filter((p) => !p.substitute);
  const awayBench = lineups.away.filter((p) => p.substitute);

  // Heuristic: an FCB column contains a player whose team-name token shows
  // up in either the home or the away label; we use the visible label match
  // since Sofascore lineup rows don't carry a teamId.
  const fcbToken = fcbName.toLowerCase();
  const homeIsFcb = homeTeam.toLowerCase().includes(fcbToken);
  const awayIsFcb = awayTeam.toLowerCase().includes(fcbToken);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 * index }}
      aria-label="Kezdő tizenegy és cserepad"
      className={cn(
        "rounded-xl border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] p-4 backdrop-blur",
      )}
    >
      <header className="mb-5 flex items-center justify-center gap-3">
        <FormationBadge formation={lineups.homeFormation} />
        <span className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
          {lineups.confirmed ? "Kezdő tizenegy" : "Várható kezdő"}
        </span>
        <FormationBadge formation={lineups.awayFormation} />
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SideColumn
          team={homeTeam}
          starters={homeStarters}
          bench={homeBench}
          highlight={homeIsFcb}
          align="left"
        />
        <SideColumn
          team={awayTeam}
          starters={awayStarters}
          bench={awayBench}
          highlight={awayIsFcb}
          align="right"
        />
      </div>
    </motion.section>
  );
}

function FormationBadge({ formation }: { formation: string | null }) {
  if (!formation) {
    return (
      <span className="rounded-full border border-dashed border-[var(--glass-border)] px-3 py-1 font-display text-xs text-[var(--text-muted)]">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1",
        "border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/8",
        "font-display text-sm tabular-nums tracking-[0.15em] text-[var(--accent-gold)]",
      )}
    >
      {formation}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Per-side column (starters + bench)
// ---------------------------------------------------------------------------

function SideColumn({
  team,
  starters,
  bench,
  highlight,
  align,
}: {
  team: string;
  starters: SofascoreLineupPlayer[];
  bench: SofascoreLineupPlayer[];
  highlight: boolean;
  align: "left" | "right";
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "mb-3 font-display text-[10px] uppercase tracking-[0.28em]",
          highlight
            ? "text-[var(--accent-gold)]"
            : "text-[var(--text-secondary)]",
          align === "right" ? "text-right sm:text-right" : "text-left",
        )}
      >
        {team}
      </p>
      <ul className="space-y-1.5">
        {starters.map((p) => (
          <PlayerRow key={`s-${p.id}`} player={p} highlight={highlight} />
        ))}
      </ul>

      {bench.length > 0 && (
        <>
          <div
            aria-hidden
            className={cn(
              "my-4 h-px",
              "bg-gradient-to-r from-transparent via-[var(--accent-gold)]/30 to-transparent",
            )}
          />
          <p className="mb-2 font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Cserepad
          </p>
          <ul className="space-y-1">
            {bench.map((p) => (
              <PlayerRow
                key={`b-${p.id}`}
                player={p}
                highlight={highlight}
                compact
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player row
// ---------------------------------------------------------------------------

function PlayerRow({
  player,
  highlight,
  compact = false,
}: {
  player: SofascoreLineupPlayer;
  highlight: boolean;
  compact?: boolean;
}) {
  const goals = player.stats.goals ?? 0;
  const assists = player.stats.assists ?? 0;

  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5",
        "border border-transparent",
        compact && "px-1.5 py-1 text-xs",
      )}
    >
      <span
        className={cn(
          "shrink-0 text-right font-mono tabular-nums",
          compact ? "w-5 text-[10px]" : "w-7 text-xs",
          "text-[var(--text-muted)]",
        )}
      >
        {player.jerseyNumber ?? "—"}
      </span>

      <PositionPill position={player.position} compact={compact} />

      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          compact ? "text-xs" : "text-sm",
          highlight
            ? "font-semibold text-[var(--accent-gold)]"
            : "text-[var(--text-primary)]",
        )}
        title={player.name}
      >
        {player.name}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {/* Card markers — yellow first, then red so a 2nd-yellow shows both. */}
        {player.stats.yellowCard && (
          <span
            aria-label="Sárga lap"
            title="Sárga lap"
            className={cn(
              "block rounded-[2px] bg-amber-400",
              compact ? "h-3 w-2" : "h-3.5 w-2.5",
            )}
          />
        )}
        {player.stats.redCard && (
          <span
            aria-label="Piros lap"
            title="Piros lap"
            className={cn(
              "block rounded-[2px] bg-rose-500",
              compact ? "h-3 w-2" : "h-3.5 w-2.5",
            )}
          />
        )}

        {goals > 0 && (
          <span
            aria-label={`${goals} gól`}
            title={`${goals} gól`}
            className={cn(
              "inline-flex items-center gap-0.5 text-[var(--accent-gold)]",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            {Array.from({ length: Math.min(goals, 3) }).map((_, i) => (
              <span key={i} aria-hidden>
                ⚽
              </span>
            ))}
            {goals > 3 && (
              <span aria-hidden className="tabular-nums">
                ×{goals}
              </span>
            )}
          </span>
        )}
        {assists > 0 && (
          <span
            aria-label={`${assists} gólpassz`}
            title={`${assists} gólpassz`}
            className={cn(
              "inline-flex items-center gap-0.5 text-[var(--accent-blue)]",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            {Array.from({ length: Math.min(assists, 3) }).map((_, i) => (
              <span key={i} aria-hidden>
                🎯
              </span>
            ))}
            {assists > 3 && (
              <span aria-hidden className="tabular-nums">
                ×{assists}
              </span>
            )}
          </span>
        )}

        <RatingBadge rating={player.stats.rating} compact={compact} />
      </span>
    </li>
  );
}

function PositionPill({
  position,
  compact = false,
}: {
  position: string | null;
  compact?: boolean;
}) {
  const meta = positionMeta(position);
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border font-display tabular-nums",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        "uppercase tracking-[0.18em]",
        meta.cls,
      )}
      title={meta.label}
    >
      {position ?? "—"}
    </span>
  );
}

function positionMeta(position: string | null): { cls: string; label: string } {
  switch (position) {
    case "G":
      return {
        cls: "border-[var(--accent-blue)]/50 bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]",
        label: "Kapus",
      };
    case "D":
      return {
        cls: "border-emerald-500/50 bg-emerald-500/12 text-emerald-300",
        label: "Védő",
      };
    case "M":
      return {
        cls: "border-[var(--accent-gold)]/50 bg-[var(--accent-gold)]/12 text-[var(--accent-gold)]",
        label: "Középpályás",
      };
    case "F":
      return {
        cls: "border-[var(--accent-red)]/50 bg-[var(--accent-red)]/12 text-[var(--accent-red)]",
        label: "Csatár",
      };
    default:
      return {
        cls: "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)]",
        label: "—",
      };
  }
}

function RatingBadge({
  rating,
  compact = false,
}: {
  rating: number | null;
  compact?: boolean;
}) {
  if (rating == null) return null;
  const tier =
    rating >= 7.0 ? "gold" : rating >= 6.0 ? "silver" : "muted";
  return (
    <span
      className={cn(
        "shrink-0 rounded-[var(--radius-sm)] border font-display tabular-nums",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-xs",
        tier === "gold" &&
          "border-[var(--accent-gold)]/50 bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]",
        tier === "silver" &&
          "border-slate-400/40 bg-slate-400/10 text-slate-200",
        tier === "muted" &&
          "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)]",
      )}
    >
      {rating.toFixed(1)}
    </span>
  );
}
