"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface WidgetShellProps {
  /** Small uppercase eyebrow label rendered above the title (Bebas Neue). */
  eyebrow: string;
  /** Main widget heading. */
  title: string;
  /** Optional small accent (e.g. "+12%" or a date). Renders right-aligned. */
  meta?: React.ReactNode;
  /** Optional CTA shown bottom-right with an arrow icon. */
  cta?: { label: string; href: string };
  /** Drives the staggered grid reveal. */
  index?: number;
  /** Visually emphasise this card (gold accent border on the eyebrow). */
  emphasized?: boolean;
  /** Pass-through Tailwind classes for grid-column span etc. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for every dashboard widget.
 *
 * Wraps a glass-card with:
 *  - An eyebrow + title header (Bebas Neue + DM Sans pairing).
 *  - Optional meta value on the right (date, badge, growth indicator).
 *  - Optional CTA link at the bottom that rises on hover.
 *  - A Framer Motion `whileInView` reveal that staggers via the `index`
 *    prop, so the dashboard cascades in even on a slow connection.
 *
 * The wrapper itself doesn't render the background — `glass-card`
 * already provides the surface. Children are responsible for the body
 * layout so each widget keeps full control over its content shape.
 */
export function WidgetShell({
  eyebrow,
  title,
  meta,
  cta,
  index = 0,
  emphasized = false,
  className,
  children,
}: WidgetShellProps) {
  return (
    <motion.section
      variants={cardVariants}
      custom={index}
      initial="hidden"
      animate="visible"
      className={cn(
        "glass-card glass-card-hover",
        "relative flex h-full flex-col gap-5 overflow-hidden p-6 sm:p-7",
        className,
      )}
    >
      {/* Soft top-edge highlight so the card edge catches the dark canvas. */}
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
              "mt-1.5 font-display text-2xl leading-tight tracking-wide",
              "text-[var(--text-primary)]",
              "sm:text-[1.65rem]",
            )}
          >
            {title}
          </h2>
        </div>
        {meta && (
          <div className="shrink-0 text-right text-xs text-[var(--text-secondary)]">
            {meta}
          </div>
        )}
      </header>

      <div className="flex-1">{children}</div>

      {cta && (
        <Link
          href={cta.href}
          className={cn(
            "group/cta inline-flex items-center gap-1.5 self-start",
            "text-sm font-medium text-[var(--text-secondary)]",
            "transition-colors duration-200 hover:text-[var(--accent-gold)]",
            "focus-visible:outline-none focus-visible:text-[var(--accent-gold)]",
          )}
        >
          <span>{cta.label}</span>
          <ArrowUpRight
            size={16}
            className="transition-transform duration-300 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </motion.section>
  );
}

/**
 * Stagger reveal driven by the widget index — rows cascade smoothly.
 * `prefers-reduced-motion` is enforced globally in `globals.css`, so we
 * don't need to short-circuit the variants here.
 */
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay: Math.min(i * 0.07, 0.42),
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};
