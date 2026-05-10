"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SofascoireShotmapEntry } from "@/lib/season-api";
import { cn } from "@/lib/utils";

interface ShotmapPanelProps {
  shotmap: SofascoireShotmapEntry[];
  homeTeam: string;
  awayTeam: string;
  index?: number;
}

/**
 * Sofascore shot-map visualised as a single-half pitch SVG.
 *
 * Sofascore reports `playerCoordinates.{x,y}` in a 0-100 system that runs
 * across the full pitch — so home and away shots originate from opposite
 * halves. To compare both teams on a single goal we mirror the away shots'
 * y axis (`y' = isHome ? y : 100 - y`), giving us a consistent "everyone
 * shooting at the same goal" layout.
 *
 * Marker shapes follow the Sofascore convention so a returning user can
 * decode them at a glance: filled gold = goal, hollow blue = save, grey X
 * = miss, orange diamond = post, slate dot = block.
 *
 * The whole panel hides itself when the array is empty.
 */
export function ShotmapPanel({
  shotmap,
  homeTeam,
  awayTeam,
  index = 0,
}: ShotmapPanelProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const totals = useMemo(() => {
    let homeXg = 0;
    let awayXg = 0;
    let homeShots = 0;
    let awayShots = 0;
    let homeGoals = 0;
    let awayGoals = 0;
    for (const shot of shotmap) {
      if (shot.isHome) {
        homeShots += 1;
        if (shot.xg != null) homeXg += shot.xg;
        if (shot.shotType === "goal") homeGoals += 1;
      } else {
        awayShots += 1;
        if (shot.xg != null) awayXg += shot.xg;
        if (shot.shotType === "goal") awayGoals += 1;
      }
    }
    return { homeXg, awayXg, homeShots, awayShots, homeGoals, awayGoals };
  }, [shotmap]);

  if (!shotmap || shotmap.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 * index }}
      aria-label="Lövéstérkép"
      className={cn(
        "rounded-xl border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] p-4 backdrop-blur",
      )}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
          Lövéstérkép
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <SideBadge
            color="var(--accent-blue)"
            label={homeTeam}
            xg={totals.homeXg}
            shots={totals.homeShots}
            goals={totals.homeGoals}
          />
          <SideBadge
            color="var(--accent-red)"
            label={awayTeam}
            xg={totals.awayXg}
            shots={totals.awayShots}
            goals={totals.awayGoals}
          />
        </div>
      </header>

      {/* Pitch + tooltip overlay container */}
      <div className="relative overflow-x-auto">
        <div className="relative mx-auto min-w-[280px] max-w-2xl">
          <svg
            viewBox="0 0 100 70"
            preserveAspectRatio="xMidYMid meet"
            className="block w-full"
            role="img"
            aria-label="Lövéstérkép — egy kapu felé tükrözve"
          >
            <Pitch />

            {shotmap.map((shot, i) => {
              const coords = projectCoords(shot);
              if (!coords) return null;
              const isHovered = hovered === i;
              return (
                <ShotMarker
                  key={i}
                  shot={shot}
                  cx={coords.x}
                  cy={coords.y}
                  hovered={isHovered}
                  onEnter={() => setHovered(i)}
                  onLeave={() => setHovered(null)}
                />
              );
            })}
          </svg>

          {/* Floating tooltip — anchored to mouse via SVG `<title>` would
              suffice for a11y, but we render a styled glass tooltip here
              so the hover hit reads as a first-class UI element. */}
          {hovered !== null && shotmap[hovered] && (
            <ShotTooltip shot={shotmap[hovered]} />
          )}
        </div>
      </div>

      {/* Legend */}
      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-[var(--text-secondary)]">
        <LegendDot kind="goal" label="Gól" />
        <LegendDot kind="save" label="Védés" />
        <LegendDot kind="miss" label="Mellé" />
        <LegendDot kind="post" label="Kapufa" />
        <LegendDot kind="block" label="Blokkolva" />
      </ul>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Pitch SVG (top-down half pitch — goal at the top edge)
// ---------------------------------------------------------------------------

function Pitch() {
  return (
    <g>
      {/* Background turf */}
      <rect x="0" y="0" width="100" height="70" rx="2" fill="#1a2e1a" opacity="0.55" />
      {/* Subtle stripe pattern for visual interest */}
      {[0, 14, 28, 42, 56].map((y, i) => (
        <rect
          key={i}
          x="0"
          y={y}
          width="100"
          height="14"
          fill={i % 2 === 0 ? "#1f3a1f" : "#1a2e1a"}
          opacity="0.4"
        />
      ))}
      {/* Outer pitch lines (goal at top, half line at bottom) */}
      <rect
        x="1"
        y="1"
        width="98"
        height="68"
        rx="1"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.4"
      />
      {/* Half-way arc — purely decorative, hints at the half line */}
      <line
        x1="0"
        y1="68"
        x2="100"
        y2="68"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.3"
        strokeDasharray="0.8 1.6"
      />
      {/* 16-yard box (penalty area): roughly from x=18 to x=82, y=0 to y=22 */}
      <rect
        x="18"
        y="1"
        width="64"
        height="22"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.4"
      />
      {/* 6-yard box (goal area): roughly from x=36 to x=64, y=0 to y=8 */}
      <rect
        x="36"
        y="1"
        width="28"
        height="8"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.4"
      />
      {/* Penalty spot */}
      <circle cx="50" cy="14" r="0.5" fill="rgba(255,255,255,0.5)" />
      {/* Penalty arc (D) — only the part outside the box */}
      <path
        d="M 42 22 A 8 8 0 0 0 58 22"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.4"
      />
      {/* Goal — slightly above the top edge */}
      <rect
        x="44"
        y="-0.6"
        width="12"
        height="1.6"
        fill="rgba(255,255,255,0.6)"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="0.3"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Shot marker
// ---------------------------------------------------------------------------

interface ShotMarkerProps {
  shot: SofascoireShotmapEntry;
  cx: number;
  cy: number;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
}

function ShotMarker({ shot, cx, cy, hovered, onEnter, onLeave }: ShotMarkerProps) {
  const ariaLabel = `${shot.playerName ?? "Ismeretlen"} — ${shotTypeLabel(shot.shotType)}`;
  const scale = hovered ? 1.4 : 1;
  const stroke = hovered ? "white" : undefined;

  switch (shot.shotType) {
    case "goal":
      return (
        <g
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          style={{ cursor: "pointer", outline: "none" }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={2.4 * scale}
            fill="var(--accent-gold)"
            stroke={stroke ?? "rgba(0,0,0,0.4)"}
            strokeWidth="0.4"
          />
        </g>
      );
    case "save":
      return (
        <g
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          style={{ cursor: "pointer", outline: "none" }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={2 * scale}
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth="0.7"
          />
        </g>
      );
    case "miss":
      // X cross
      return (
        <g
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          style={{ cursor: "pointer", outline: "none" }}
        >
          <line
            x1={cx - 1.6 * scale}
            y1={cy - 1.6 * scale}
            x2={cx + 1.6 * scale}
            y2={cy + 1.6 * scale}
            stroke={hovered ? "white" : "#9ca3af"}
            strokeWidth="0.6"
            strokeLinecap="round"
          />
          <line
            x1={cx - 1.6 * scale}
            y1={cy + 1.6 * scale}
            x2={cx + 1.6 * scale}
            y2={cy - 1.6 * scale}
            stroke={hovered ? "white" : "#9ca3af"}
            strokeWidth="0.6"
            strokeLinecap="round"
          />
        </g>
      );
    case "post":
      // Diamond (rotated square)
      return (
        <g
          transform={`translate(${cx}, ${cy}) rotate(45) scale(${scale})`}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          style={{ cursor: "pointer", outline: "none" }}
        >
          <rect
            x={-1.6}
            y={-1.6}
            width={3.2}
            height={3.2}
            fill="#fb923c"
            stroke={stroke ?? "rgba(0,0,0,0.4)"}
            strokeWidth="0.3"
          />
        </g>
      );
    case "block":
    default:
      return (
        <g
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          style={{ cursor: "pointer", outline: "none" }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={1.6 * scale}
            fill="#a78bfa"
            opacity="0.75"
            stroke={stroke ?? "rgba(0,0,0,0.4)"}
            strokeWidth="0.3"
          />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// Tooltip (positioned absolutely over the SVG)
// ---------------------------------------------------------------------------

function ShotTooltip({ shot }: { shot: SofascoireShotmapEntry }) {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2",
        "rounded-[var(--radius-sm)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg-strong)] backdrop-blur-md",
        "px-3 py-1.5 text-[11px] shadow-[var(--shadow-md)]",
        "whitespace-nowrap",
      )}
    >
      <span className="font-medium text-[var(--text-primary)]">
        {shot.playerName ?? "Ismeretlen"}
      </span>
      <span className="ml-2 text-[var(--text-secondary)]">
        {shotTypeLabel(shot.shotType)}
      </span>
      {shot.xg != null && (
        <span className="ml-2 font-display tabular-nums text-[var(--accent-gold)]">
          xG {shot.xg.toFixed(2)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side badge (top-right xG totals)
// ---------------------------------------------------------------------------

function SideBadge({
  color,
  label,
  xg,
  shots,
  goals,
}: {
  color: string;
  label: string;
  xg: number;
  shots: number;
  goals: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border",
        "border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "px-2.5 py-1",
      )}
    >
      <span
        aria-hidden
        className="block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <span className="max-w-[110px] truncate font-medium text-[var(--text-primary)]">
        {label}
      </span>
      <span className="tabular-nums text-[var(--text-secondary)]">
        {goals}-{shots}
      </span>
      <span className="font-display tabular-nums text-[var(--accent-gold)]">
        xG {xg.toFixed(2)}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Legend dot
// ---------------------------------------------------------------------------

function LegendDot({
  kind,
  label,
}: {
  kind: "goal" | "save" | "miss" | "post" | "block";
  label: string;
}) {
  const swatch = (() => {
    switch (kind) {
      case "goal":
        return (
          <span
            aria-hidden
            className="block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--accent-gold)" }}
          />
        );
      case "save":
        return (
          <span
            aria-hidden
            className="block h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: "var(--accent-blue)" }}
          />
        );
      case "miss":
        return (
          <span aria-hidden className="block text-[10px] leading-none text-[var(--text-secondary)]">
            ✕
          </span>
        );
      case "post":
        return (
          <span
            aria-hidden
            className="block h-2 w-2 rotate-45"
            style={{ background: "#fb923c" }}
          />
        );
      case "block":
        return (
          <span
            aria-hidden
            className="block h-2 w-2 rounded-full"
            style={{ background: "#a78bfa" }}
          />
        );
    }
  })();
  return (
    <li className="inline-flex items-center gap-1.5">
      {swatch}
      <span>{label}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Sofascore shot to viewBox coordinates (0..100 x, 0..70 y).
 *
 * - Sofascore's `playerCoordinates.x` and `.y` are 0-100 across the full pitch.
 *   We mirror the away shots' `y` so all attempts map to the SAME goal at the
 *   top edge (`y = isHome ? y : 100 - y`).
 * - We then rescale `y ∈ [0, 100]` → `[0, 70]` to match our taller viewBox so
 *   the half-pitch fills the canvas without distortion.
 */
function projectCoords(
  shot: SofascoireShotmapEntry,
): { x: number; y: number } | null {
  const c = shot.playerCoordinates;
  if (!c) return null;
  const yMirrored = shot.isHome ? c.y : 100 - c.y;
  // Sofascore shots happen mostly in the attacking third (y < 35). We
  // remap [0..50] of the pitch length onto our 70-tall canvas so the
  // markers spread across the visible half rather than clustering near
  // the top edge. Anything beyond half-way is clamped to the half line.
  const yHalf = Math.min(yMirrored, 50);
  const yScaled = (yHalf / 50) * 68 + 1; // leave a 1px margin top/bottom
  return {
    x: Math.max(2, Math.min(98, c.x)),
    y: yScaled,
  };
}

function shotTypeLabel(shotType: string): string {
  switch (shotType) {
    case "goal":
      return "Gól";
    case "save":
      return "Védés";
    case "miss":
      return "Mellé";
    case "post":
      return "Kapufa";
    case "block":
      return "Blokkolva";
    default:
      return shotType;
  }
}
