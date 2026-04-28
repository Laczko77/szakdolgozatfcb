"use client";

import { motion } from "framer-motion";
import type { DreamTeamFormation, Player } from "@/types/database";
import {
  FORMATIONS,
  type FormationSlot,
  slotAcceptsPosition,
} from "@/lib/dream-team-formations";
import { PlayerSlot } from "@/components/dream-team/PlayerSlot";

interface PitchSVGProps {
  formation: DreamTeamFormation;
  /** slotIndex → playerId placement map. */
  placements: Record<number, string | undefined>;
  /** Lookup table for players currently on the pitch. */
  playerById: Record<string, Player>;
  /**
   * The player currently being dragged. Used to highlight compatible /
   * incompatible drop zones in real time.
   */
  draggingPosition: string | null;
  /** Mobile tap-to-select: id of the player currently armed for placement. */
  selectedPoolPlayerId: string | null;
  /** Mobile tap on an empty slot — try to place the armed player there. */
  onSlotTap: (slot: FormationSlot) => void;
  /** Remove a player from a slot (mobile "X" button or desktop fallback). */
  onRemovePlayer: (slotIndex: number) => void;
  /** True when running on a touch / no-hover device. */
  isMobile: boolean;
}

/**
 * Sematikus SVG focipálya. A pálya egy 800×1100 viewBox — minden vonal
 * UEFA-szerű arányokkal (kapuelőtér, büntetőterület, középkör).
 *
 * A slot pozíciók a {@link FORMATIONS} százalékos koordinátáiból kerülnek
 * abszolút pixel-koordinátákra leképezésre. Framer Motion a slot
 * containerek `layout` proppal animálja a formáció váltást — minden
 * `slotIndex` egy egyedi React `key`, így a slotok fizikailag
 * "elcsúsznak" az új helyre, nem ugranak.
 */
export function PitchSVG({
  formation,
  placements,
  playerById,
  draggingPosition,
  selectedPoolPlayerId,
  onSlotTap,
  onRemovePlayer,
  isMobile,
}: PitchSVGProps) {
  const slots = FORMATIONS[formation];

  // ViewBox dimensions — 800 wide × 1100 tall keeps the realistic pitch
  // aspect ratio (≈68m × 105m) without making the page absurdly tall.
  const VIEW_W = 800;
  const VIEW_H = 1100;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block w-full select-none"
        role="img"
        aria-label="Álomcsapat pálya"
      >
        <defs>
          {/* Pitch grass — subtle vertical bands of green so the dark-mode
              theme stays moody but you can still read the surface. */}
          <linearGradient id="dt-pitch-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e3b1f" />
            <stop offset="50%" stopColor="#0a2e18" />
            <stop offset="100%" stopColor="#082413" />
          </linearGradient>

          {/* Stripes pattern — alternating slightly darker rows. */}
          <pattern
            id="dt-pitch-stripes"
            width={VIEW_W}
            height={VIEW_H / 8}
            patternUnits="userSpaceOnUse"
          >
            <rect width={VIEW_W} height={VIEW_H / 16} fill="rgba(255,255,255,0.03)" />
            <rect
              y={VIEW_H / 16}
              width={VIEW_W}
              height={VIEW_H / 16}
              fill="rgba(0,0,0,0.05)"
            />
          </pattern>

          {/* Vignette — fades the corners so the pitch feels like it sits
              inside a glass card rather than a hard rectangle. */}
          <radialGradient id="dt-pitch-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>

          {/* Slot glow — used when a compatible drop zone lights up. */}
          <radialGradient id="dt-slot-glow-ok" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34,197,94,0.45)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0)" />
          </radialGradient>
          <radialGradient id="dt-slot-glow-bad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(248,113,113,0.35)" />
            <stop offset="100%" stopColor="rgba(248,113,113,0)" />
          </radialGradient>
        </defs>

        {/* Pitch surface */}
        <rect width={VIEW_W} height={VIEW_H} fill="url(#dt-pitch-grass)" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#dt-pitch-stripes)" />

        {/* Outer touchline */}
        <PitchLines viewW={VIEW_W} viewH={VIEW_H} />

        {/* Vignette goes ABOVE the lines so corner pixels darken naturally. */}
        <rect
          width={VIEW_W}
          height={VIEW_H}
          fill="url(#dt-pitch-vignette)"
          pointerEvents="none"
        />
      </svg>

      {/* Slot overlay — absolutely positioned over the SVG so we can
          render React/Framer-Motion components for each droppable cell. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-label="Játékos pozíciók"
      >
        {slots.map((slot) => {
          const playerId = placements[slot.slotIndex];
          const player = playerId ? playerById[playerId] : undefined;
          const isCompatible = draggingPosition
            ? slotAcceptsPosition(slot, draggingPosition)
            : null;

          // For tap-to-select on mobile: a slot is "armed for placement"
          // when (a) a pool player is selected and (b) it can land here.
          const armedForSelected =
            isMobile && selectedPoolPlayerId
              ? slotAcceptsPosition(
                  slot,
                  playerById[selectedPoolPlayerId]?.position ?? null,
                ) && !player
              : false;

          return (
            <motion.div
              key={slot.slotIndex}
              layout
              layoutId={`slot-${slot.slotIndex}`}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
              className="pointer-events-auto absolute"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <PlayerSlot
                slot={slot}
                player={player}
                isCompatible={isCompatible}
                isDragging={draggingPosition !== null}
                armedForSelected={armedForSelected}
                onTap={() => onSlotTap(slot)}
                onRemove={() => onRemovePlayer(slot.slotIndex)}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- pitch line geometry ---------- */

function PitchLines({ viewW, viewH }: { viewW: number; viewH: number }) {
  // Margin between touchline and viewBox edge.
  const M = 40;
  const lineColor = "rgba(255,255,255,0.55)";
  const subtleLine = "rgba(255,255,255,0.35)";
  const sw = 2.5; // stroke width

  // Penalty / goal box ratios — eyeballed against UEFA standards but
  // remapped to our 800 × 1100 viewBox so they read at this aspect.
  const penaltyW = 380; // total width of penalty box
  const penaltyH = 160;
  const goalAreaW = 180;
  const goalAreaH = 60;

  const cx = viewW / 2;

  return (
    <g
      stroke={lineColor}
      strokeWidth={sw}
      fill="none"
      shapeRendering="geometricPrecision"
    >
      {/* Outer touchline */}
      <rect
        x={M}
        y={M}
        width={viewW - 2 * M}
        height={viewH - 2 * M}
        rx={4}
      />

      {/* Halfway line */}
      <line x1={M} y1={viewH / 2} x2={viewW - M} y2={viewH / 2} />

      {/* Centre circle + spot */}
      <circle cx={cx} cy={viewH / 2} r={92} />
      <circle cx={cx} cy={viewH / 2} r={3.5} fill={lineColor} stroke="none" />

      {/* Top (away) penalty box */}
      <rect
        x={cx - penaltyW / 2}
        y={M}
        width={penaltyW}
        height={penaltyH}
      />
      {/* Top goal area */}
      <rect
        x={cx - goalAreaW / 2}
        y={M}
        width={goalAreaW}
        height={goalAreaH}
      />
      {/* Top penalty spot */}
      <circle
        cx={cx}
        cy={M + 110}
        r={3.5}
        fill={lineColor}
        stroke="none"
      />
      {/* Top "D" — arc on the edge of the penalty box */}
      <path
        d={`M ${cx - 50} ${M + penaltyH} A 50 50 0 0 0 ${cx + 50} ${M + penaltyH}`}
      />

      {/* Bottom (own) penalty box */}
      <rect
        x={cx - penaltyW / 2}
        y={viewH - M - penaltyH}
        width={penaltyW}
        height={penaltyH}
      />
      {/* Bottom goal area */}
      <rect
        x={cx - goalAreaW / 2}
        y={viewH - M - goalAreaH}
        width={goalAreaW}
        height={goalAreaH}
      />
      {/* Bottom penalty spot */}
      <circle
        cx={cx}
        cy={viewH - M - 110}
        r={3.5}
        fill={lineColor}
        stroke="none"
      />
      {/* Bottom D */}
      <path
        d={`M ${cx - 50} ${viewH - M - penaltyH} A 50 50 0 0 1 ${cx + 50} ${viewH - M - penaltyH}`}
      />

      {/* Corner arcs */}
      {[
        [M, M],
        [viewW - M, M],
        [M, viewH - M],
        [viewW - M, viewH - M],
      ].map(([x, y], idx) => {
        // Each corner arc is a quarter circle whose direction depends on
        // which corner we are in. Simplest approach: draw a small ¼-arc
        // path with the right sweep flag per corner.
        const r = 14;
        const isTop = y === M;
        const isLeft = x === M;
        const startX = isLeft ? x + r : x - r;
        const endX = x;
        const startY = y;
        const endY = isTop ? y + r : y - r;
        const sweep = isLeft ? (isTop ? 1 : 0) : isTop ? 0 : 1;
        return (
          <path
            key={idx}
            d={`M ${startX} ${startY} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`}
            stroke={subtleLine}
            strokeWidth={sw}
          />
        );
      })}

      {/* Goalmouth (visual flourish — the actual goals) */}
      <rect
        x={cx - 35}
        y={M - 10}
        width={70}
        height={10}
        stroke={subtleLine}
      />
      <rect
        x={cx - 35}
        y={viewH - M}
        width={70}
        height={10}
        stroke={subtleLine}
      />
    </g>
  );
}
