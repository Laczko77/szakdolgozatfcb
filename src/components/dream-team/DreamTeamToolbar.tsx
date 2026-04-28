"use client";

import { cn } from "@/lib/utils";

interface DreamTeamToolbarProps {
  hasSavedTeam: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  placedCount: number;
  /** Persisted team name (used as the input default value). */
  name: string;
  onNameChange: (next: string) => void;
  onSave: () => void;
  onReset: () => void;
  onRequestDelete: () => void;
}

/**
 * Akció sáv: csapat neve input + Mentés / Új / Törlés gombok.
 * A "Mentés" gomb csak akkor aktív, ha van változás vagy még nincs mentve.
 * A "Törlés" csak akkor jelenik meg, ha van perzisztált csapat.
 */
export function DreamTeamToolbar({
  hasSavedTeam,
  isDirty,
  isSaving,
  isDeleting,
  placedCount,
  name,
  onNameChange,
  onSave,
  onReset,
  onRequestDelete,
}: DreamTeamToolbarProps) {
  const canSave = !isSaving && (isDirty || !hasSavedTeam) && placedCount > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md",
        "px-4 py-3 shadow-[var(--shadow-md)]",
        "sm:flex-row sm:items-center sm:gap-4 sm:px-5",
      )}
    >
      {/* Name input */}
      <div className="flex-1">
        <label
          htmlFor="dream-team-name"
          className="block font-display text-[10px] uppercase tracking-[0.3em] text-[var(--accent-gold)]"
        >
          Csapat neve
        </label>
        <input
          id="dream-team-name"
          type="text"
          value={name}
          maxLength={100}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Álomcsapatom"
          className={cn(
            "mt-1 w-full bg-transparent text-lg font-display tracking-wide text-[var(--text-primary)] outline-none",
            "placeholder:text-[var(--text-secondary)]",
            "border-b border-transparent focus:border-[var(--accent-gold)] transition-colors",
          )}
        />
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          {placedCount} / 11 játékos elhelyezve
          {hasSavedTeam && isDirty && (
            <span className="ml-2 text-[var(--accent-gold)]">• nem mentett változások</span>
          )}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={isSaving || isDeleting}
          className="glass-button-secondary disabled:opacity-50"
        >
          Új álomcsapat
        </button>

        {hasSavedTeam && (
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={isSaving || isDeleting}
            className={cn(
              "rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2",
              "text-sm font-medium text-red-400 transition-colors",
              "hover:bg-red-500/20 hover:border-red-500/60",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
              "outline-none",
            )}
          >
            {isDeleting ? "Törlés…" : "Törlés"}
          </button>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="glass-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Mentés…" : hasSavedTeam ? "Mentés" : "Mentés mint új"}
        </button>
      </div>
    </div>
  );
}
