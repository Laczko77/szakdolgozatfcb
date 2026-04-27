"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminButton } from "./AdminButton";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  totalLabel?: string;
}

/**
 * Compact prev/next pagination control. Reads "{N}/{Total}" rather than
 * spelling out a long page-number list — admins know the count and the
 * lists are short.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalLabel,
}: PaginationProps) {
  if (totalPages <= 1 && !totalLabel) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--glass-border)] px-4 py-3">
      <span className="text-xs text-[var(--text-secondary)]">
        {totalLabel ?? `${page} / ${Math.max(totalPages, 1)} oldal`}
      </span>
      <div className="flex items-center gap-2">
        <AdminButton
          variant="subtle"
          size="sm"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Előző oldal"
        >
          <ChevronLeft className="h-4 w-4" />
          Előző
        </AdminButton>
        <AdminButton
          variant="subtle"
          size="sm"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Következő oldal"
        >
          Következő
          <ChevronRight className="h-4 w-4" />
        </AdminButton>
      </div>
    </div>
  );
}
