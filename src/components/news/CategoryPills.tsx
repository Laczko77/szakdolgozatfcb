"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from "@/lib/constants";

export type CategoryValue = "" | ArticleCategory;

interface CategoryPillsProps {
  active: CategoryValue;
  onChange: (next: CategoryValue) => void;
}

/**
 * Horizontally scrollable pill filter for news categories.
 *
 * Mirrors the shop's CategoryFilter (F8) on purpose — users build
 * muscle memory across listing pages.  The "Mind" entry sits first
 * and clears the filter (empty string == no category param).
 *
 * The active pill carries a Framer Motion shared layout `layoutId`
 * so switching categories animates the highlight horizontally
 * rather than fading it on/off — small detail, big polish.
 */
export function CategoryPills({ active, onChange }: CategoryPillsProps) {
  const options: { value: CategoryValue; label: string }[] = [
    { value: "", label: "Mind" },
    ...ARTICLE_CATEGORIES.map((c) => ({
      value: c,
      label: ARTICLE_CATEGORY_LABELS[c],
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Hír kategória szűrő"
      className={cn(
        "no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-2",
        "sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
      )}
    >
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value || "all"}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors duration-200",
              "border",
              isActive
                ? "border-[var(--accent-gold)] text-[var(--text-primary)]"
                : "border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--glass-border-hover)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="news-category-pill-bg"
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-[var(--glass-bg-strong)] backdrop-blur-md"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {option.label}
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
