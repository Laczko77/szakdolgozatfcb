"use client";

import { motion, type Variants } from "framer-motion";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartShellProps {
  /** Small uppercase eyebrow above the title (Bebas Neue, gold). */
  eyebrow: string;
  /** Main section heading. */
  title: string;
  /** Optional supporting paragraph below the title. */
  description?: string;
  /** Right-aligned meta — typically a badge or "frissítve" label. */
  meta?: React.ReactNode;
  /** Stagger index — drives the whileInView reveal cascade. */
  index?: number;
  /** Pass-through Tailwind classes (e.g. grid-column span). */
  className?: string;
  /** When set, renders a fine gold accent on the eyebrow + top edge. */
  emphasized?: boolean;
  /** Footer area pinned below the body — e.g. legend / disclaimer. */
  footer?: React.ReactNode;
  /** Show a "Nagyítás" button in the top-right corner. */
  zoomable?: boolean;
  /** Click handler for the zoom button. Required when `zoomable` is true. */
  onZoom?: () => void;
  children: React.ReactNode;
}

/**
 * Glass-card section wrapper for every chart on the /season page.
 *
 * Visual contract mirrors WidgetShell (used on the dashboard) but:
 *  - reveals on scroll (`whileInView`) instead of immediately, since the
 *    page is a long vertical document, not a viewport-sized dashboard;
 *  - hosts a longer descriptive paragraph between header and body so the
 *    charts get proper editorial framing;
 *  - exposes a `footer` slot for legends and free-tier disclaimers.
 */
export function ChartShell({
  eyebrow,
  title,
  description,
  meta,
  index = 0,
  className,
  emphasized = false,
  footer,
  zoomable = false,
  onZoom,
  children,
}: ChartShellProps) {
  return (
    <motion.section
      variants={sectionVariants}
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className={cn(
        "glass-card glass-card-hover",
        "relative flex h-full flex-col gap-6 overflow-hidden p-6 sm:p-8",
        className,
      )}
    >
      {/* Soft top-edge highlight matching the dashboard widgets. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-6 top-0 h-px",
          "bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent",
          emphasized ? "opacity-100" : "opacity-50",
        )}
      />

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cn(
              "font-display text-[11px] uppercase tracking-[0.32em]",
              emphasized
                ? "text-[var(--accent-gold)]"
                : "text-[var(--text-muted)]",
            )}
          >
            {eyebrow}
          </p>
          <h2
            className={cn(
              "mt-2 font-display text-3xl leading-tight tracking-wide",
              "text-[var(--text-primary)]",
              "sm:text-[2rem]",
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta && (
            <div className="text-right text-xs text-[var(--text-secondary)]">
              {meta}
            </div>
          )}
          {zoomable && onZoom && (
            <button
              type="button"
              onClick={onZoom}
              aria-label="Nagyítás"
              title="Nagyítás"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center",
                "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "text-[var(--text-secondary)]",
                "transition-colors duration-200",
                "hover:border-[var(--accent-gold)]/60 hover:bg-[var(--glass-bg-hover)] hover:text-[var(--accent-gold)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              )}
            >
              <Maximize2 size={14} aria-hidden />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1">{children}</div>

      {footer && (
        <div className="border-t border-[var(--glass-border)] pt-4 text-xs text-[var(--text-muted)]">
          {footer}
        </div>
      )}
    </motion.section>
  );
}

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: Math.min(i * 0.06, 0.36),
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};
