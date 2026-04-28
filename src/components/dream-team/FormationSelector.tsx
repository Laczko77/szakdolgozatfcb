"use client";

import type { DreamTeamFormation } from "@/types/database";
import {
  DREAM_TEAM_FORMATIONS,
  FORMATION_LABELS,
} from "@/lib/dream-team-formations";
import { cn } from "@/lib/utils";

interface FormationSelectorProps {
  current: DreamTeamFormation;
  onChange: (next: DreamTeamFormation) => void;
}

/**
 * Pill-csoport a 4 elérhető formáció között váltáshoz.
 * Az aktív gomb arany kerettel + finom glow-val emelkedik ki.
 */
export function FormationSelector({
  current,
  onChange,
}: FormationSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Formáció választása"
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-full border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] p-1 backdrop-blur-md",
      )}
    >
      {DREAM_TEAM_FORMATIONS.map((formation) => {
        const isActive = formation === current;
        return (
          <button
            key={formation}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(formation)}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-xs font-display tracking-wider sm:px-4 sm:py-2 sm:text-sm",
              "transition-all duration-200 outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
              isActive
                ? "bg-[var(--accent-gold)] text-[#1A1A2E] shadow-[0_0_18px_rgba(196,163,77,0.4)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            {FORMATION_LABELS[formation]}
          </button>
        );
      })}
    </div>
  );
}
