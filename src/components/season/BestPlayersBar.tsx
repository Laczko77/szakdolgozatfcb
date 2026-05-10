"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import type { SofascoireBestPlayers } from "@/lib/season-api";
import { cn } from "@/lib/utils";

interface BestPlayersBarProps {
  bestPlayers: SofascoireBestPlayers | null;
  homeTeam: string;
  awayTeam: string;
  /** Stagger index so multiple panels in the timeline cascade in. */
  index?: number;
}

/**
 * "Meccs embere" comparator strip — renders Sofascore's per-side best player
 * picks side-by-side with their match rating.
 *
 * Layout: a three-column glass card. Left = home pick, centre = the "vs"
 * separator, right = away pick. Either side may be `null` (Sofascore did
 * not surface a pick); when one side is missing we collapse to a single
 * centred row instead of leaving an awkward empty cell.
 *
 * Renders `null` outright when both sides are missing — the parent panel
 * decides whether to show the section based on this.
 */
export function BestPlayersBar({
  bestPlayers,
  homeTeam,
  awayTeam,
  index = 0,
}: BestPlayersBarProps) {
  if (!bestPlayers) return null;
  const { home, away } = bestPlayers;
  if (!home && !away) return null;

  const onlyOne = (!home && away) || (home && !away);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: 0.04 * index }}
      aria-label="A meccs legjobbjai"
      className={cn(
        "rounded-xl border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] px-4 py-3 backdrop-blur",
      )}
    >
      <p className="mb-2 text-center font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
        A meccs legjobbjai
      </p>
      <div
        className={cn(
          "grid items-center gap-3",
          onlyOne ? "grid-cols-1" : "grid-cols-[1fr_auto_1fr]",
        )}
      >
        {home && (
          <BestPlayerSide
            team={homeTeam}
            name={home.name}
            rating={home.rating}
            align="left"
          />
        )}
        {!onlyOne && (
          <span
            aria-hidden
            className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]"
          >
            ←&nbsp;vs&nbsp;→
          </span>
        )}
        {away && (
          <BestPlayerSide
            team={awayTeam}
            name={away.name}
            rating={away.rating}
            align={onlyOne ? "left" : "right"}
          />
        )}
      </div>
    </motion.section>
  );
}

function BestPlayerSide({
  team,
  name,
  rating,
  align,
}: {
  team: string;
  name: string;
  rating: number | null;
  align: "left" | "right";
}) {
  const isElite = rating != null && rating >= 8.0;
  const isStrong = rating != null && rating >= 7.0 && rating < 8.0;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" ? "justify-end" : "justify-start",
      )}
    >
      {align === "left" && (
        <Star
          size={14}
          aria-hidden
          className={cn(
            "shrink-0 fill-current",
            isElite
              ? "text-[var(--accent-gold)]"
              : "text-[var(--accent-gold-subtle)]",
          )}
        />
      )}
      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="truncate font-display text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
          {team}
        </p>
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {name}
        </p>
      </div>
      {rating != null && (
        <span
          className={cn(
            "shrink-0 rounded-[var(--radius-sm)] border px-2 py-1",
            "font-display text-sm tabular-nums",
            isElite &&
              "border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] shadow-[var(--shadow-glow-gold)]",
            isStrong &&
              "border-[var(--accent-gold-subtle)]/60 bg-[var(--accent-gold)]/8 text-[var(--accent-gold)]",
            !isElite &&
              !isStrong &&
              "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]",
          )}
        >
          {rating.toFixed(1)}
        </span>
      )}
      {align === "right" && (
        <Star
          size={14}
          aria-hidden
          className={cn(
            "shrink-0 fill-current",
            isElite
              ? "text-[var(--accent-gold)]"
              : "text-[var(--accent-gold-subtle)]",
          )}
        />
      )}
    </div>
  );
}
