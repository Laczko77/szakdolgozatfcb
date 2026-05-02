"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DeleteConfirmModalProps {
  open: boolean;
  teamName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Megerősítő modal az álomcsapat törléséhez.
 *
 * Egyszerű glass-card overlay backdrop blur-rel — nem használunk
 * Radix Dialog-ot mert ez a komponens izolált és csak ide kell.
 * Escape gomb és backdrop kattintás zárja.
 */
export function DeleteConfirmModal({
  open,
  teamName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, isDeleting, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dt-delete-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dt-delete-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Bezárás"
            onClick={() => !isDeleting && onCancel()}
            className="glass-modal-backdrop absolute inset-0"
            tabIndex={-1}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "glass-modal relative w-full max-w-md p-6",
              "shadow-[var(--shadow-glow-gold)]",
            )}
          >
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
              Megerősítés szükséges
            </p>
            <h2
              id="dt-delete-title"
              className="mt-2 font-display text-2xl tracking-wide text-[var(--text-primary)]"
            >
              Törlöd az álomcsapatot?
            </h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              A{" "}
              <span className="text-[var(--text-primary)]">
                &bdquo;{teamName}&rdquo;
              </span>{" "}
              nevű álomcsapatod véglegesen törlődik. Ez a művelet nem vonható
              vissza.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={isDeleting}
                className="glass-button-secondary disabled:opacity-50"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className={cn(
                  "rounded-full border border-red-500/60 bg-red-500/15 px-5 py-2.5",
                  "text-sm font-medium text-red-300 transition-colors",
                  "hover:bg-red-500/25",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                )}
              >
                {isDeleting ? "Törlés…" : "Igen, töröld"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
