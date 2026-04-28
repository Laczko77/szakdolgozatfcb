"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { hasStats, type PlayerStats } from "@/lib/players-api";
import { PlayerStatsEmpty } from "./PlayerStatGrid";

interface PlayerStatRadarProps {
  stats: PlayerStats;
}

/**
 * Sugárdiagram a játékos teljesítményéről.
 *
 * A nyers számok skálái messze nem összemérhetők (pl. ~3000 perc vs. 5
 * sárga lap), ezért minden tengelyt egy pozíció-független felső becslésre
 * normalizálunk 0–100 közé. A becslés értékeket a tipikus élvonalbeli
 * szezonbeli maximumokhoz igazítottuk — ettől a radar mindig "kitölthető",
 * de a magasabb értékek mindig nagyobb formát rajzolnak.
 *
 * Ha kiemelkedő játékos átlépi a maximumot, simán 100-nál cap-eljük
 * (pl. Lewandowski 35+ gól a felső becslés 40-éből = 88%).
 */

interface AxisDef {
  key: keyof PlayerStats;
  label: string;
  max: number;
}

const AXES: ReadonlyArray<AxisDef> = [
  { key: "goals", label: "Gól", max: 40 },
  { key: "assists", label: "Gólpassz", max: 25 },
  { key: "appearances", label: "Meccs", max: 50 },
  { key: "minutes", label: "Perc", max: 4500 },
  { key: "yellow_cards", label: "Sárga", max: 12 },
  { key: "red_cards", label: "Piros", max: 4 },
];

export function PlayerStatRadar({ stats }: PlayerStatRadarProps) {
  if (!hasStats(stats)) {
    return <PlayerStatsEmpty />;
  }

  const data = AXES.map((axis) => {
    const raw = stats[axis.key] ?? 0;
    const normalized = Math.min(100, Math.round((raw / axis.max) * 100));
    return {
      label: axis.label,
      value: normalized,
      raw,
    };
  });

  return (
    <div className="relative h-[320px] w-full sm:h-[380px]" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid
            stroke="var(--glass-border-hover)"
            strokeDasharray="2 4"
          />
          <PolarAngleAxis
            dataKey="label"
            tick={{
              fill: "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "var(--font-display), sans-serif",
              letterSpacing: "0.08em",
            }}
            stroke="var(--glass-border)"
          />
          <Radar
            name="Teljesítmény"
            dataKey="value"
            stroke="var(--accent-gold)"
            strokeWidth={2}
            fill="var(--accent-gold)"
            fillOpacity={0.22}
            dot={{
              r: 3,
              fill: "var(--accent-gold)",
              stroke: "var(--accent-gold)",
            }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Centre crest watermark — pure decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span
          className="font-display text-5xl tracking-widest"
          style={{
            color: "var(--accent-gold)",
            opacity: 0.07,
          }}
        >
          FCB
        </span>
      </div>
    </div>
  );
}
