"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { SectorWithAvailability } from "@/lib/tickets-api";

interface StadiumMapProps {
  sectors: SectorWithAvailability[];
  selectedSectorId: string | null;
  onSelect: (sectorId: string) => void;
  /** Pass-through styling. */
  className?: string;
}

/**
 * Schematic SVG stadium with up to 8 clickable sector blocks arranged
 * around a centred pitch. Camp Nou-inspired: oval bowl, two longer "main
 * stand" sectors along the touchlines, tighter blocks behind each goal,
 * and four corner wedges.
 *
 * Color rules:
 *   - available  → translucent fill with the team's blue accent;
 *   - sold out   → muted glass with a subtle diagonal hatch pattern;
 *   - selected   → gold fill + glow + scale-up.
 *
 * Hover surfaces a glass tooltip with name, free seats and price/jegy.
 * Sectors that are sold out can't be selected — pointer-events stay on
 * so the tooltip still renders, but the click handler is a no-op.
 *
 * The SVG uses `viewBox` + `preserveAspectRatio` so it scales fluidly to
 * fill the parent. On mobile the parent stacks the {@link SectorListAlt}
 * underneath so users with cramped touch targets aren't forced into the
 * SVG to make a selection.
 */
export function StadiumMap({
  sectors,
  selectedSectorId,
  onSelect,
  className,
}: StadiumMapProps) {
  const layout = useMemo(() => assignLayout(sectors), [sectors]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const titleId = useId();

  // Tooltip target — hover wins over selection so users can inspect a
  // different sector without losing their current selection.
  const tooltipSector =
    layout.find((l) => l.sector.id === hoverId)?.sector ??
    layout.find((l) => l.sector.id === selectedSectorId)?.sector ??
    null;

  return (
    <div className={cn("relative", className)}>
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox="0 0 600 420"
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
      >
        <title id={titleId}>Stadion szektor térkép</title>

        <defs>
          {/* Sold-out diagonal hatch — drawn once, referenced by fill. */}
          <pattern
            id="sector-soldout-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.35"
            />
          </pattern>

          {/* Soft gold glow used on the selected sector. */}
          <filter id="sector-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pitch turf gradient for visual depth. */}
          <linearGradient id="pitch-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.18)" />
            <stop offset="100%" stopColor="rgba(34, 197, 94, 0.06)" />
          </linearGradient>
        </defs>

        {/* Outer stadium shell — gives the SVG its silhouette. */}
        <ellipse
          cx="300"
          cy="210"
          rx="282"
          ry="196"
          fill="var(--glass-bg)"
          stroke="var(--glass-border-hover)"
          strokeWidth="1.5"
        />
        <ellipse
          cx="300"
          cy="210"
          rx="252"
          ry="172"
          fill="transparent"
          stroke="var(--glass-border)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        {/* Pitch + centre circle */}
        <rect
          x="190"
          y="142"
          width="220"
          height="136"
          rx="6"
          fill="url(#pitch-grass)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
        <line
          x1="300"
          y1="142"
          x2="300"
          y2="278"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
        <circle
          cx="300"
          cy="210"
          r="18"
          fill="transparent"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
        <circle cx="300" cy="210" r="2" fill="rgba(255,255,255,0.4)" />

        {/* Sectors */}
        {layout.map(({ sector, path, labelX, labelY }) => {
          const isSelected = sector.id === selectedSectorId;
          const isSoldOut = sector.is_sold_out;
          const isInteractive = !isSoldOut;

          return (
            <g
              key={sector.id}
              className={cn(
                "transition-[transform,opacity] duration-300",
                isInteractive && "cursor-pointer",
                isSelected && "[transform-box:fill-box] [transform-origin:center]",
              )}
              style={isSelected ? { transform: "scale(1.04)" } : undefined}
              onClick={() => {
                if (isInteractive) onSelect(sector.id);
              }}
              onMouseEnter={() => setHoverId(sector.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(sector.id)}
              onBlur={() => setHoverId(null)}
              tabIndex={isInteractive ? 0 : -1}
              role={isInteractive ? "button" : undefined}
              aria-label={describeSector(sector)}
              aria-pressed={isSelected || undefined}
              onKeyDown={(e) => {
                if (
                  isInteractive &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  onSelect(sector.id);
                }
              }}
            >
              {/* Sold-out hatch underlay — drawn first so the colored fill
                  on top still reads, with the hatch peeking through at low
                  opacity. */}
              {isSoldOut && (
                <path
                  d={path}
                  fill="url(#sector-soldout-hatch)"
                  className="text-[var(--text-muted)]"
                />
              )}

              <path
                d={path}
                fill={
                  isSelected
                    ? "var(--accent-gold)"
                    : isSoldOut
                      ? "var(--glass-bg-strong)"
                      : "var(--accent-blue-subtle)"
                }
                fillOpacity={
                  isSelected ? 0.32 : isSoldOut ? 0.55 : 0.5
                }
                stroke={
                  isSelected
                    ? "var(--accent-gold)"
                    : isSoldOut
                      ? "var(--glass-border)"
                      : "var(--accent-blue)"
                }
                strokeWidth={isSelected ? 2.5 : 1.25}
                filter={isSelected ? "url(#sector-glow)" : undefined}
                className={cn(
                  "transition-[fill,fill-opacity,stroke,stroke-width] duration-300",
                  isInteractive &&
                    "[&:hover]:fill-[var(--accent-gold)] [&:hover]:fill-opacity-[0.22] [&:hover]:stroke-[var(--accent-gold)]",
                )}
              />

              {/* Sector label */}
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  "pointer-events-none select-none font-display",
                  "text-[12px] tracking-[0.18em]",
                )}
                fill={
                  isSelected
                    ? "var(--accent-gold)"
                    : isSoldOut
                      ? "var(--text-muted)"
                      : "var(--text-primary)"
                }
                opacity={isSoldOut ? 0.75 : 1}
              >
                {sector.sector_name}
              </text>
            </g>
          );
        })}

        {/* Compass-style "north" marker — small editorial detail. */}
        <text
          x="300"
          y="22"
          textAnchor="middle"
          fontSize="9"
          letterSpacing="3"
          className="font-display"
          fill="var(--text-muted)"
        >
          ÉSZAK
        </text>
      </svg>

      {/* Tooltip — anchored above the SVG centre on small screens, lower-right
          on larger ones. Renders only when there's something to hover/select. */}
      {tooltipSector && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3 top-3",
            "flex max-w-[220px] flex-col gap-1.5 rounded-[var(--radius-md)] p-3",
            "border border-[var(--glass-border-hover)] bg-[var(--glass-bg-strong)]",
            "backdrop-blur-md shadow-[var(--shadow-md)]",
          )}
        >
          <p className="font-display text-sm tracking-wide text-[var(--text-primary)]">
            {tooltipSector.sector_name}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {tooltipSector.is_sold_out
              ? "Betelt"
              : `${tooltipSector.available_seats} szabad hely / ${tooltipSector.total_seats}`}
          </p>
          <p className="text-xs font-medium text-[var(--accent-gold)]">
            {formatPrice(Number(tooltipSector.price))} / jegy
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        <LegendDot
          colorClass="bg-[var(--accent-blue)]"
          label="Elérhető"
        />
        <LegendDot
          colorClass="bg-[var(--accent-gold)]"
          label="Kiválasztva"
        />
        <LegendDot
          colorClass="bg-[var(--glass-bg-strong)] border border-[var(--glass-border)]"
          label="Betelt"
        />
      </div>
    </div>
  );
}

function LegendDot({
  colorClass,
  label,
}: {
  colorClass: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", colorClass)}
      />
      {label}
    </span>
  );
}

function describeSector(sector: SectorWithAvailability): string {
  if (sector.is_sold_out) {
    return `${sector.sector_name} szektor — betelt`;
  }
  return `${sector.sector_name} szektor — ${sector.available_seats} szabad hely, ${formatPrice(Number(sector.price))} jegyenként`;
}

// ---------------------------------------------------------------------------
// Layout — assign each sector to one of 8 fixed slots around the bowl
// ---------------------------------------------------------------------------

type SectorSlot = {
  /** SVG path describing the sector's wedge / block. */
  path: string;
  /** Centre X for the label. */
  labelX: number;
  /** Centre Y for the label. */
  labelY: number;
};

/**
 * Eight predefined slots — clockwise from the top centre. Every slot is a
 * stylised arc-section of the bowl. We fall back to a more generic 6-slot
 * arrangement when there are fewer sectors so the empty space doesn't
 * feel sparse.
 *
 * Coordinates are tuned for a 600×420 viewBox.
 */
const SLOTS_8: SectorSlot[] = [
  // North main stand (centre top)
  {
    path: "M 220 38 Q 300 16 380 38 L 380 96 Q 300 80 220 96 Z",
    labelX: 300,
    labelY: 64,
  },
  // North-east corner
  {
    path: "M 380 38 Q 478 56 540 110 L 482 134 Q 432 96 380 96 Z",
    labelX: 460,
    labelY: 88,
  },
  // East stand (centre right, behind goal-line view)
  {
    path: "M 540 110 Q 580 162 580 210 L 522 210 Q 522 168 482 134 Z",
    labelX: 548,
    labelY: 168,
  },
  // South-east corner
  {
    path: "M 580 210 Q 580 258 540 310 L 482 286 Q 522 252 522 210 Z",
    labelX: 548,
    labelY: 252,
  },
  // South main stand (centre bottom)
  {
    path: "M 540 310 Q 460 364 380 382 L 380 324 Q 432 324 482 286 Z",
    labelX: 458,
    labelY: 332,
  },
  // South-west wing
  {
    path: "M 380 382 Q 300 404 220 382 L 220 324 Q 300 340 380 324 Z",
    labelX: 300,
    labelY: 356,
  },
  // West stand (lower)
  {
    path: "M 220 382 Q 122 364 60 310 L 118 286 Q 168 324 220 324 Z",
    labelX: 140,
    labelY: 332,
  },
  // West stand (upper) + NW corner
  {
    path: "M 60 310 Q 20 258 20 210 Q 20 162 60 110 L 118 134 Q 78 168 78 210 Q 78 252 118 286 Z",
    labelX: 52,
    labelY: 210,
  },
];

/**
 * Six-slot fallback for small datasets — the bowl looks balanced even
 * with only a handful of sectors. The layout still uses the 8-slot
 * positions, just collapsing the corner wedges into the adjacent main
 * stands so each sector reads as a meaningful block.
 */
const SLOTS_6: SectorSlot[] = [
  {
    path: "M 200 38 Q 300 14 400 38 L 400 100 Q 300 82 200 100 Z",
    labelX: 300,
    labelY: 66,
  },
  {
    path: "M 400 38 Q 540 70 580 210 L 522 210 Q 510 130 400 100 Z",
    labelX: 510,
    labelY: 130,
  },
  {
    path: "M 580 210 Q 540 350 400 382 L 400 324 Q 510 290 522 210 Z",
    labelX: 510,
    labelY: 290,
  },
  {
    path: "M 400 382 Q 300 406 200 382 L 200 324 Q 300 340 400 324 Z",
    labelX: 300,
    labelY: 354,
  },
  {
    path: "M 200 382 Q 60 350 20 210 L 78 210 Q 90 290 200 324 Z",
    labelX: 88,
    labelY: 290,
  },
  {
    path: "M 20 210 Q 60 70 200 38 L 200 100 Q 90 130 78 210 Z",
    labelX: 88,
    labelY: 130,
  },
];

function assignLayout(
  sectors: SectorWithAvailability[],
): Array<SectorSlot & { sector: SectorWithAvailability }> {
  const slots = sectors.length <= 6 ? SLOTS_6 : SLOTS_8;
  return sectors.slice(0, slots.length).map((sector, i) => ({
    ...slots[i],
    sector,
  }));
}
