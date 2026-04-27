"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/constants";
import { PLAYER_POSITION_LABELS } from "@/lib/player-positions";

export type PositionFilterValue = "" | PlayerPosition;

interface PositionPillsProps {
  active: PositionFilterValue;
  onChange: (next: PositionFilterValue) => void;
  /** Optional per-bucket counts shown as a small numeric badge inside the pill. */
  counts?: Partial<Record<PlayerPosition | "all", number>>;
}

/**
 * Pozíció szűrő pill row — mirrors the news CategoryPills (F6) on
 * purpose so users carry their muscle memory across listing pages.
 *
 * The active pill carries a Framer Motion shared layout `layoutId`
 * so the highlight slides between options instead of fading on/off.
 */
export function PositionPills({ active, onChange, counts }: PositionPillsProps) {
  const options: { value: PositionFilterValue; label: string; countKey: PlayerPosition | "all" }[] = [
    { value: "", label: "Mind", countKey: "all" },
    ...PLAYER_POSITIONS.map((p) => ({
      value: p,
      label: PLAYER_POSITION_LABELS[p],
      countKey: p,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Pozíció szűrő"
      className={cn(
        "no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-2",
        "sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
      )}
    >
      {options.map((option) => {
        const isActive = option.value === active;
        const count = counts?.[option.countKey];
        return (
          <button
            key={option.value || "all"}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors duration-200",
              "border inline-flex items-center gap-2",
              isActive
                ? "border-[var(--accent-gold)] text-[var(--text-primary)]"
                : "border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--glass-border-hover)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="players-position-pill-bg"
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-[var(--glass-bg-strong)] backdrop-blur-md"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span>{option.label}</span>
            {typeof count === "number" && (
              <span
                aria-hidden
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  isActive
                    ? "bg-[var(--accent-gold)] text-[#0a0e1a]"
                    : "bg-[var(--glass-bg)] text-[var(--text-muted)]",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
