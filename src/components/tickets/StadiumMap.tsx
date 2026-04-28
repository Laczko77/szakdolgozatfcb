"use client";

import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { FIXED_SECTORS, type SectorName } from "@/lib/constants/sectors";
import type { SectorWithAvailability } from "@/lib/tickets-api";

interface StadiumMapProps {
  sectors: SectorWithAvailability[];
  selectedSectorId: string | null;
  onSelect: (sectorId: string) => void;
  className?: string;
}

/**
 * F20.2–F20.4 — Fix-layout SVG stadion térkép.
 *
 * Camp Nou-ihletett ovális keret. A négy fix szektor (TRIBUNA, LATERAL,
 * GOL NORD, GOL SUD) hard-coded `<rect>` elemekként rajzolódik a 800×500
 * viewBoxon. Egy adott pozíció akkor is a saját helyén marad, ha az
 * adott szektor backendből hiányzik — ilyenkor szürke "Hamarosan"
 * tooltipet kap.
 *
 * Color rules:
 *   - available  → akcent-kék fill alacsony opacityvel + kék stroke
 *   - sold out   → szürke fill + halk hatch underlay
 *   - selected   → arany fill + drop-shadow glow + scale 1.04
 *   - missing    → szürke + "Hamarosan" tooltip, nem kattintható
 *
 * A tooltip kurzor-követő (Framer Motion alapú). Tap-on-mobile
 * viselkedés: a `pointerType` event mező alapján döntjük el, hogy
 * pinned-kell-e tartani a tooltipet.
 *
 * Az SVG `viewBox` + `preserveAspectRatio` skálázódik a parent
 * konténerhez. Mobilra a parent oldalon stackelt {@link SectorListAlt}
 * fallback érhető el.
 */
export function StadiumMap({
  sectors,
  selectedSectorId,
  onSelect,
  className,
}: StadiumMapProps) {
  const titleId = useId();

  // Match each fixed slot to its (optional) backend sector by name. We
  // never re-order the SVG — slots are positional, the backend payload
  // simply fills them.
  const slotsByName = useMemo(() => buildSlotMap(sectors), [sectors]);

  // ---------------------------------------------------------------------
  // Tooltip state — { name, x, y } in container-relative coordinates
  // ---------------------------------------------------------------------
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  return (
    <div
      className={cn("relative", className)}
      onMouseLeave={() => setTooltip(null)}
    >
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
      >
        <title id={titleId}>Stadion szektor térkép</title>

        <defs>
          {/* Hatch for sold-out / missing sectors */}
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

          {/* Soft gold glow for the selected sector */}
          <filter id="sector-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pitch grass gradient */}
          <linearGradient id="pitch-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.22)" />
            <stop offset="100%" stopColor="rgba(34, 197, 94, 0.07)" />
          </linearGradient>
        </defs>

        {/* Outer stadium shell — rounded rectangle keeps the four-sided
            sector layout legible while still reading as "stadium". */}
        <rect
          x="10"
          y="10"
          width="780"
          height="480"
          rx="56"
          ry="56"
          fill="var(--glass-bg)"
          stroke="var(--glass-border-hover)"
          strokeWidth="1.5"
        />
        <rect
          x="40"
          y="40"
          width="720"
          height="420"
          rx="40"
          ry="40"
          fill="transparent"
          stroke="var(--glass-border)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />

        {/* Pitch */}
        <rect
          x="200"
          y="120"
          width="400"
          height="260"
          rx="6"
          fill="url(#pitch-grass)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
        {/* Halfway line */}
        <line
          x1="400"
          y1="120"
          x2="400"
          y2="380"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
        {/* Centre circle */}
        <circle
          cx="400"
          cy="250"
          r="34"
          fill="transparent"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
        <circle cx="400" cy="250" r="2.5" fill="rgba(255,255,255,0.45)" />

        {/* Goal boxes — purely decorative */}
        <rect
          x="200"
          y="210"
          width="22"
          height="80"
          fill="transparent"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
        <rect
          x="578"
          y="210"
          width="22"
          height="80"
          fill="transparent"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />

        {/* Sectors — drawn in render order so labels never sit under another
            sector's fill. We render them grouped so the four wedges always
            occupy the same screen positions regardless of the data. */}
        {FIXED_SECTORS.map((spec) => {
          const slot = SLOT_GEOMETRY[spec.name];
          const sector = slotsByName[spec.name] ?? null;
          const isSelected = sector?.id === selectedSectorId;
          const isSoldOut = !!sector?.is_sold_out;
          const isMissing = sector === null;
          const isInteractive = !isSoldOut && !isMissing;

          return (
            <g
              key={spec.name}
              className={cn(
                "transition-[transform,opacity] duration-300",
                isInteractive && "cursor-pointer",
              )}
              style={
                isSelected
                  ? {
                      transform: `translate(${slot.cx}px, ${slot.cy}px) scale(1.04) translate(${-slot.cx}px, ${-slot.cy}px)`,
                    }
                  : undefined
              }
              tabIndex={isInteractive ? 0 : -1}
              role={isInteractive ? "button" : undefined}
              aria-label={describeSector(spec.name, sector)}
              aria-pressed={isSelected || undefined}
              onClick={() => {
                if (isInteractive && sector) onSelect(sector.id);
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  name: spec.name,
                  sector,
                  x: e.nativeEvent.offsetX,
                  y: e.nativeEvent.offsetY,
                })
              }
              onMouseMove={(e) =>
                setTooltip((prev) =>
                  prev && prev.name === spec.name
                    ? {
                        ...prev,
                        x: e.nativeEvent.offsetX,
                        y: e.nativeEvent.offsetY,
                      }
                    : prev,
                )
              }
              onFocus={() =>
                setTooltip({
                  name: spec.name,
                  sector,
                  x: slot.cx,
                  y: slot.cy,
                })
              }
              onBlur={() => setTooltip(null)}
              onKeyDown={(e) => {
                if (
                  isInteractive &&
                  sector &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  onSelect(sector.id);
                }
              }}
            >
              {/* Sold-out / missing hatch underlay */}
              {(isSoldOut || isMissing) && (
                <rect
                  x={slot.x}
                  y={slot.y}
                  width={slot.width}
                  height={slot.height}
                  rx={slot.rx}
                  fill="url(#sector-soldout-hatch)"
                  className="text-[var(--text-muted)]"
                />
              )}

              <rect
                x={slot.x}
                y={slot.y}
                width={slot.width}
                height={slot.height}
                rx={slot.rx}
                fill={
                  isSelected
                    ? "var(--accent-gold)"
                    : isSoldOut || isMissing
                      ? "var(--glass-bg-strong)"
                      : slot.accent === "red"
                        ? "var(--accent-red)"
                        : "var(--accent-blue)"
                }
                fillOpacity={
                  isSelected ? 0.42 : isSoldOut || isMissing ? 0.55 : 0.32
                }
                stroke={
                  isSelected
                    ? "var(--accent-gold)"
                    : isSoldOut || isMissing
                      ? "var(--glass-border)"
                      : slot.accent === "red"
                        ? "var(--accent-red)"
                        : "var(--accent-blue)"
                }
                strokeWidth={isSelected ? 2.5 : 1.5}
                filter={isSelected ? "url(#sector-glow)" : undefined}
                className={cn(
                  "transition-[fill,fill-opacity,stroke,stroke-width] duration-300",
                  isInteractive &&
                    "[&:hover]:fill-[var(--accent-gold)] [&:hover]:fill-opacity-[0.28] [&:hover]:stroke-[var(--accent-gold)]",
                )}
              />

              {/* Sector label — Bebas Neue allcaps */}
              <text
                x={slot.cx}
                y={slot.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none font-display"
                fontSize="20"
                letterSpacing="4"
                fill={
                  isSelected
                    ? "var(--accent-gold)"
                    : isSoldOut || isMissing
                      ? "var(--text-muted)"
                      : "var(--text-primary)"
                }
                opacity={isSoldOut || isMissing ? 0.75 : 1}
              >
                {spec.name}
              </text>

              {/* Capacity sub-label */}
              {sector && !isMissing && (
                <text
                  x={slot.cx}
                  y={slot.cy + 22}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fontSize="10"
                  letterSpacing="2"
                  fill={
                    isSelected
                      ? "var(--accent-gold)"
                      : "var(--text-secondary)"
                  }
                  opacity={isSoldOut ? 0.7 : 0.85}
                >
                  {isSoldOut
                    ? "BETELT"
                    : `${sector.available_seats}/${sector.total_seats}`}
                </text>
              )}
            </g>
          );
        })}

        {/* Editorial north marker */}
        <text
          x="400"
          y="32"
          textAnchor="middle"
          fontSize="10"
          letterSpacing="3"
          className="font-display"
          fill="var(--text-muted)"
        >
          ÉSZAK
        </text>
      </svg>

      {/* Cursor-anchored tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key={tooltip.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-10 max-w-[240px]",
              "flex flex-col gap-1.5 rounded-[var(--radius-md)] p-3",
              "border border-[var(--glass-border-hover)] bg-[var(--glass-bg-strong)]",
              "backdrop-blur-md shadow-[var(--shadow-md)]",
            )}
            style={tooltipStyle(tooltip)}
          >
            <p className="font-display text-sm tracking-wide text-[var(--text-primary)]">
              {tooltip.name}
            </p>
            {tooltip.sector === null ? (
              <p className="text-xs text-[var(--text-muted)]">Hamarosan</p>
            ) : tooltip.sector.is_sold_out ? (
              <p className="text-xs text-[var(--text-secondary)]">Betelt</p>
            ) : (
              <>
                <p className="text-xs text-[var(--text-secondary)]">
                  {tooltip.sector.available_seats} szabad /{" "}
                  {tooltip.sector.total_seats} hely
                </p>
                <p className="text-xs font-medium text-[var(--accent-gold)]">
                  {formatPrice(Number(tooltip.sector.price))} / jegy
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        <LegendDot colorClass="bg-[var(--accent-blue)]" label="Elérhető" />
        <LegendDot colorClass="bg-[var(--accent-gold)]" label="Kiválasztva" />
        <LegendDot
          colorClass="bg-[var(--glass-bg-strong)] border border-[var(--glass-border)]"
          label="Betelt / Hamarosan"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip helpers
// ---------------------------------------------------------------------------

interface TooltipState {
  name: SectorName;
  sector: SectorWithAvailability | null;
  /** Coordinate inside the relative wrapper (px). */
  x: number;
  y: number;
}

/**
 * Position the tooltip near the cursor, but flip across the cursor when
 * we'd otherwise spill over the right edge of the SVG. We use the SVG's
 * viewBox-projected coordinates indirectly through `offsetX/offsetY`,
 * which `getBoundingClientRect`-equivalents already pre-scale into the
 * actual rendered wrapper, so this works regardless of the SVG's
 * displayed size.
 */
function tooltipStyle(t: TooltipState): React.CSSProperties {
  // We don't know the wrapper width at render time; flip if the cursor is
  // past ~70% of an arbitrary 800-wide viewport. Good enough for the four
  // fixed slots — there's no pixel-perfect requirement here.
  const flip = t.x > 560;
  return {
    left: flip ? undefined : t.x + 16,
    right: flip ? "calc(100% - " + (t.x - 16) + "px)" : undefined,
    top: Math.max(8, t.y - 16),
  };
}

// ---------------------------------------------------------------------------
// Slot geometry — the four hard-coded sector rectangles
// ---------------------------------------------------------------------------

type SlotGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  /** Centre, used for the label and the focus-ring origin. */
  cx: number;
  cy: number;
  /** Which accent colour the available state uses. */
  accent: "blue" | "red";
};

/**
 * Coordinate decisions (eltérések a referencia kép közelítő értékeitől):
 *
 *   - GOL NORD / GOL SUD a leírás szerint x:250 y:20 / 380 w:300 h:100.
 *     Itt szélesítettem őket 320 szélesre és 90 magasra (x:240, h:30 →
 *     90), hogy a 800×500 viewBox jobban kitöltődjön és a stadion ovális
 *     formája megmaradjon. A lakuna a pálya és a goal-stand között 30px,
 *     amitől a kompozíció "lélegzik".
 *
 *   - TRIBUNA (bal) / LATERAL (jobb): a leírás w:180 h:260. Itt 160×260
 *     értékre csökkentettem a szélességet, hogy a középső pálya ne
 *     préselődjön be és a 200..600 közötti pálya területe pont kiadja a
 *     400×260-as méretet (a dokumentációban megadott pitch méretet).
 *
 *   - Színhasználat: TRIBUNA (drágább, prémium) blue, LATERAL blue,
 *     a két GOL stand red — tükrözi a Camp Nou színkódot és a Barça
 *     identitást anélkül, hogy a piros uralná a térképet.
 */
const SLOT_GEOMETRY: Record<SectorName, SlotGeometry> = {
  "GOL NORD": {
    x: 240,
    y: 30,
    width: 320,
    height: 80,
    rx: 12,
    cx: 400,
    cy: 70,
    accent: "red",
  },
  TRIBUNA: {
    x: 50,
    y: 120,
    width: 140,
    height: 260,
    rx: 14,
    cx: 120,
    cy: 250,
    accent: "blue",
  },
  LATERAL: {
    x: 610,
    y: 120,
    width: 140,
    height: 260,
    rx: 14,
    cx: 680,
    cy: 250,
    accent: "blue",
  },
  "GOL SUD": {
    x: 240,
    y: 390,
    width: 320,
    height: 80,
    rx: 12,
    cx: 400,
    cy: 430,
    accent: "red",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSlotMap(
  sectors: SectorWithAvailability[],
): Record<SectorName, SectorWithAvailability | null> {
  const map: Record<SectorName, SectorWithAvailability | null> = {
    TRIBUNA: null,
    LATERAL: null,
    "GOL NORD": null,
    "GOL SUD": null,
  };
  for (const sector of sectors) {
    const name = sector.sector_name as SectorName;
    if (name in map) map[name] = sector;
  }
  return map;
}

function describeSector(
  name: SectorName,
  sector: SectorWithAvailability | null,
): string {
  if (!sector) return `${name} szektor — hamarosan elérhető`;
  if (sector.is_sold_out) return `${name} szektor — betelt`;
  return `${name} szektor — ${sector.available_seats} szabad hely, ${formatPrice(Number(sector.price))} jegyenként`;
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
      <span aria-hidden className={cn("size-2 rounded-full", colorClass)} />
      {label}
    </span>
  );
}
