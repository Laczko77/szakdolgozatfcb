"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  /** "" for "Mind" — passes no filter to the API. */
  value: string;
  label: string;
}

interface CategoryFilterProps {
  options: CategoryOption[];
  active: string;
  onChange: (value: string) => void;
}

/**
 * Horizontally scrollable pill filter — same pattern as the news category
 * filter (F6), kept consistent so users build muscle memory across lists.
 *
 * On overflow the row turns into a touch-scrollable strip with the
 * scrollbar hidden — the user can still pan with a horizontal swipe on
 * touch devices and shift+wheel on desktop.
 */
export function CategoryFilter({
  options,
  active,
  onChange,
}: CategoryFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Kategória szűrő"
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
                layoutId="category-filter-bg"
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
