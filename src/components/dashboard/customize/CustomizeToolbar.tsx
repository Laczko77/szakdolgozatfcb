"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomizeToolbarProps {
  customizing: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onEnter: () => void;
  onCancel: () => void;
  onSave: () => void;
  onResetRequest: () => void;
}

/**
 * F30.3 — a dashboard tetején ülő pill-toolbar.
 *
 * Default állapot: egyetlen "Testreszabás" gomb (ceruza-szerű ikon).
 * Customize állapot: Mégse / Visszaállítás / Mentés gombsor, animált belépéssel.
 *
 * A "Mentés" gomb csak akkor aktív, ha a felhasználó tényleg módosított —
 * érintetlen layouttal nem írunk ki a backendnek (nincs "save no-op").
 */
export function CustomizeToolbar({
  customizing,
  isDirty,
  isSaving,
  onEnter,
  onCancel,
  onSave,
  onResetRequest,
}: CustomizeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <AnimatePresence mode="wait" initial={false}>
        {customizing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center justify-end gap-2 sm:gap-3"
          >
            {/* Mégse */}
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className={cn(
                "glass-button-secondary inline-flex items-center gap-2",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <X size={14} aria-hidden />
              <span>Mégse</span>
            </button>

            {/* Visszaállítás alapértelmezettre */}
            <button
              type="button"
              onClick={onResetRequest}
              disabled={isSaving}
              className={cn(
                "glass-button-secondary inline-flex items-center gap-2",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <RotateCcw size={14} aria-hidden />
              <span className="hidden sm:inline">Visszaállítás</span>
              <span className="sm:hidden">Visszaállítás</span>
            </button>

            {/* Mentés */}
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || !isDirty}
              className={cn(
                "glass-button-primary inline-flex items-center gap-2",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Check size={14} aria-hidden />
              )}
              <span>{isSaving ? "Mentés…" : "Mentés"}</span>
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="enter"
            type="button"
            onClick={onEnter}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "glass-button-secondary inline-flex items-center gap-2",
              "hover:text-[var(--accent-gold)]",
            )}
          >
            <SlidersHorizontal size={14} aria-hidden />
            <span>Testreszabás</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
