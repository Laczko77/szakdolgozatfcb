"use client";

import { motion } from "framer-motion";
import type { Player } from "@/types/database";
import type { PlayerPosition } from "@/lib/constants";
import {
  PLAYER_POSITION_LABELS_PLURAL,
  PLAYER_POSITION_SHORT,
} from "@/lib/player-positions";
import { PlayerCard } from "./PlayerCard";

interface PositionSectionProps {
  position: PlayerPosition;
  players: Player[];
  /** Used to give the first row of the first section image priority. */
  isFirstSection?: boolean;
}

/**
 * Egy pozíciócsoport renderelése: arany pre-cím + nagy display-fontos
 * fejléc + 4/3/2 oszlopos rács. A fejléc fade-up Framer Motion belépéssel
 * jön be (`whileInView`), a kártyák index-alapú stagger-rel a kártya
 * komponensből.
 */
export function PositionSection({
  position,
  players,
  isFirstSection = false,
}: PositionSectionProps) {
  if (players.length === 0) return null;

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
      }}
      aria-labelledby={`position-${position}`}
      className="space-y-5 sm:space-y-7"
    >
      <header className="flex items-end justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
            {`#${PLAYER_POSITION_SHORT[position]} // Pozíció`}
          </p>
          <h2
            id={`position-${position}`}
            className="mt-2 font-display text-3xl tracking-wide text-[var(--text-primary)] sm:text-4xl lg:text-5xl"
          >
            {PLAYER_POSITION_LABELS_PLURAL[position]}
          </h2>
        </div>
        <span
          aria-hidden
          className="hidden font-display text-sm uppercase tracking-[0.25em] text-[var(--text-muted)] sm:inline"
        >
          {players.length} játékos
        </span>
      </header>

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {players.map((player, i) => (
          <PlayerCard
            key={player.id}
            player={player}
            index={i}
            priority={isFirstSection && i < 4}
          />
        ))}
      </ul>
    </motion.section>
  );
}
