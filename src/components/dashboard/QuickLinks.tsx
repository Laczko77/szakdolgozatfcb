"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Newspaper,
  ShoppingBag,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickLink {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Drives the per-tile accent colour. */
  accent: "gold" | "blue" | "red" | "neutral";
}

const QUICK_LINKS: readonly QuickLink[] = [
  {
    label: "Hírek",
    description: "A legfrissebb cikkek",
    href: "/hirek",
    icon: Newspaper,
    accent: "gold",
  },
  {
    label: "Shop",
    description: "Új mezek és kiegészítők",
    href: "/shop",
    icon: ShoppingBag,
    accent: "red",
  },
  {
    label: "Jegyek",
    description: "Camp Nou élmény",
    href: "/jegyek",
    icon: Ticket,
    accent: "blue",
  },
  {
    label: "Közösség",
    description: "Posztok és reakciók",
    href: "/kozosseg",
    icon: Users,
    accent: "neutral",
  },
] as const;

interface QuickLinksProps {
  index?: number;
  className?: string;
}

/**
 * Four-tile grid pointing at the main destinations of the portal.
 *
 * Each tile is a small glass card with an icon disc on the left and the
 * label + supporting copy on the right. The icon disc takes the
 * accent colour (gold / blue / red / neutral) so the row stays visually
 * varied without screaming. Hover lifts the tile and brightens its
 * border — same vocabulary as the rest of the dashboard.
 *
 * The shell is rendered as a `<section>` rather than going through
 * {@link WidgetShell} because we want a 4-up grid inside a single card,
 * which doesn't fit the eyebrow + cta pattern.
 */
export function QuickLinks({ index = 0, className }: QuickLinksProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.07, 0.42),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "glass-card relative overflow-hidden p-6 sm:p-7",
        className,
      )}
      aria-labelledby="quicklinks-title"
    >
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
            Gyors hozzáférés
          </p>
          <h2
            id="quicklinks-title"
            className={cn(
              "mt-1.5 font-display text-2xl leading-tight tracking-wide",
              "text-[var(--text-primary)] sm:text-[1.65rem]",
            )}
          >
            Hova ugornál tovább?
          </h2>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((link, i) => (
          <QuickLinkTile key={link.href} link={link} index={i} />
        ))}
      </ul>
    </motion.section>
  );
}

function QuickLinkTile({ link, index }: { link: QuickLink; index: number }) {
  const { icon: Icon } = link;
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.18 + index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <Link
        href={link.href}
        className={cn(
          "group flex h-full items-center gap-3 rounded-[var(--radius-md)]",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "p-3.5 transition-all duration-300",
          "hover:-translate-y-0.5 hover:border-[var(--glass-border-hover)]",
          "hover:bg-[var(--glass-bg-hover)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "border transition-transform duration-300 group-hover:scale-105",
            ACCENT_CLASSES[link.accent],
          )}
        >
          <Icon size={18} aria-hidden />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "font-display text-base tracking-wide text-[var(--text-primary)]",
              "transition-colors duration-200 group-hover:text-[var(--accent-gold)]",
            )}
          >
            {link.label}
          </p>
          <p className="line-clamp-1 text-xs text-[var(--text-secondary)]">
            {link.description}
          </p>
        </div>
      </Link>
    </motion.li>
  );
}

const ACCENT_CLASSES: Record<QuickLink["accent"], string> = {
  gold:
    "border-[var(--accent-gold)] bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)]",
  blue:
    "border-[var(--accent-blue)] bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)]",
  red:
    "border-[var(--accent-red)] bg-[var(--accent-red-subtle)] text-[var(--accent-red)]",
  neutral:
    "border-[var(--glass-border-hover)] bg-[var(--glass-bg)] text-[var(--text-primary)]",
};
