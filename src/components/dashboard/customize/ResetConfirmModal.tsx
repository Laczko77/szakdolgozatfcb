"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface ResetConfirmModalProps {
  open: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * F30.7 — megerősítő modális a "Visszaállítás alapértelmezettre" akcióhoz.
 *
 * Backdrop click és Escape mindketten megszakítják (kivéve közben futó
 * mentés alatt). A primer CTA `autoFocus`-os, hogy keyboard-flow közben
 * Enter is erősítsen.
 */
export function ResetConfirmModal({
  open,
  isSubmitting,
  onCancel,
  onConfirm,
}: ResetConfirmModalProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isSubmitting, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="reset-confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="reset-confirm-title"
        >
          <button
            type="button"
            aria-label="Bezárás"
            onClick={isSubmitting ? undefined : onCancel}
            className="glass-modal-backdrop absolute inset-0 cursor-default"
            tabIndex={-1}
          />

          <motion.div
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }
            }
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn("glass-modal relative w-full max-w-md")}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accent-gold) 50%, transparent)",
              }}
            />

            <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <div>
                <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                  Visszaállítás
                </p>
                <h2
                  id="reset-confirm-title"
                  className="mt-1.5 font-display text-2xl tracking-wide text-[var(--text-primary)]"
                >
                  Biztosan visszaállítod?
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                aria-label="Mégse"
                className={cn(
                  "rounded-full p-1.5 text-[var(--text-muted)]",
                  "transition-colors hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]",
                  "disabled:opacity-50",
                )}
              >
                <X size={16} />
              </button>
            </header>

            <div className="px-6 pb-2">
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                A dashboard widget elrendezésed visszaáll az alapértelmezett
                konfigurációra. Ez a művelet törli a mentett sorrendet és a
                rejtett widgetek listáját.
              </p>

              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
                <AlertTriangle
                  size={13}
                  className="mt-0.5 shrink-0 text-[var(--accent-gold)]"
                  aria-hidden
                />
                A művelet nem visszavonható.
              </p>
            </div>

            <footer className="flex items-center justify-end gap-3 px-6 py-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="glass-button-secondary"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                autoFocus
                className={cn(
                  "glass-button-primary inline-flex items-center gap-2",
                  isSubmitting && "cursor-not-allowed opacity-70",
                )}
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Visszaállítás…</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} aria-hidden />
                    <span>Visszaállítás</span>
                  </>
                )}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
