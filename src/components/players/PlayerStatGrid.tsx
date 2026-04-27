"use client";

import { motion } from "framer-motion";
import type { PlayerStats } from "@/lib/players-api";

interface PlayerStatGridProps {
  stats: PlayerStats;
}

/**
 * Numerikus statisztika kártyák progress-bar dekorációval.
 *
 * Komplementer a `PlayerStatRadar`-hoz: a radar a vizuális forma, ez a
 * nyers szám és a relatív erősség. A bar `width` viewport-enterre
 * animálódik (Framer `whileInView`), így a számok megjelenése
 * "életre kel".
 */

interface BarDef {
  key: keyof PlayerStats;
  label: string;
  /** felső skála a relatív sáv-szélességhez */
  max: number;
  /** szín-akcent — egyik tengely arany, gólok pirosak, lapok sárga, stb. */
  accent: string;
  format?: (n: number) => string;
}

const BARS: ReadonlyArray<BarDef> = [
  { key: "goals", label: "Gól", max: 40, accent: "var(--accent-red)" },
  { key: "assists", label: "Gólpassz", max: 25, accent: "var(--accent-gold)" },
  { key: "appearances", label: "Meccs", max: 50, accent: "var(--accent-blue)" },
  {
    key: "minutes",
    label: "Játékperc",
    max: 4500,
    accent: "var(--accent-blue)",
    format: (n) => n.toLocaleString("hu-HU"),
  },
  {
    key: "yellow_cards",
    label: "Sárga lap",
    max: 12,
    accent: "#facc15",
  },
  {
    key: "red_cards",
    label: "Piros lap",
    max: 4,
    accent: "var(--accent-red)",
  },
];

export function PlayerStatGrid({ stats }: PlayerStatGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {BARS.map((bar, i) => {
        const raw = stats[bar.key] ?? 0;
        const pct = Math.min(100, Math.round((raw / bar.max) * 100));
        return (
          <motion.li
            key={bar.key}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
              delay: i * 0.05,
            }}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 backdrop-blur"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                {bar.label}
              </span>
              <span
                className="font-display text-2xl leading-none tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {bar.format ? bar.format(raw) : raw}
              </span>
            </div>

            <div
              className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--glass-bg-hover)]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${bar.label}: ${raw}`}
            >
              <motion.span
                className="block h-full"
                style={{ background: bar.accent }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.9,
                  ease: [0.22, 1, 0.36, 1],
                  delay: i * 0.05 + 0.1,
                }}
              />
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
