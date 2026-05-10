"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface ChartZoomModalProps {
  open: boolean;
  /** Modal title — typically the chart's `eyebrow` or `title`. */
  title: string;
  /** Sub-line (description / context) under the title. */
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Glass modal overlay used by the /season chart cards' "Nagyítás" button.
 *
 * Renders the chart at a generous 600px tall canvas inside a `glass-modal`
 * panel so users can scrutinise the data without leaving the page. Closes
 * on backdrop click or ESC; pinned to a portal so the parent's `overflow-
 * hidden` glass-card cannot clip it.
 */
export function ChartZoomModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: ChartZoomModalProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="chart-zoom"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-6 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <button
            type="button"
            aria-label="Bezárás"
            onClick={onClose}
            tabIndex={-1}
            className="glass-modal-backdrop absolute inset-0 cursor-default"
          />

          <motion.div
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }
            }
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              "glass-modal relative w-full max-w-4xl",
              "max-h-[90vh] overflow-hidden flex flex-col",
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accent-gold) 50%, transparent)",
              }}
            />

            <header className="flex items-start justify-between gap-3 border-b border-[var(--glass-border)] px-6 py-5">
              <div className="min-w-0">
                <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                  Nagyított nézet
                </p>
                <h2 className="mt-1.5 font-display text-2xl tracking-wide text-[var(--text-primary)] sm:text-3xl">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Bezárás"
                className={cn(
                  "shrink-0 rounded-full p-2 text-[var(--text-muted)]",
                  "transition-colors hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                )}
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-auto px-4 py-6 sm:px-6">
              <div className="h-[600px] w-full">{children}</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
