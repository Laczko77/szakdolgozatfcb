"use client";

import { cn } from "@/lib/utils";

interface MatchesTableSkeletonProps {
  rows?: number;
  className?: string;
}

/**
 * F20.1 — Loading placeholder that mirrors the table's outer shape.
 * Renders five empty rows by default so the layout doesn't visibly snap
 * once data lands.
 *
 * The mobile fallback (under sm) collapses to a stack of strips that
 * mirror {@link MatchListMobile}'s height/padding instead of the table
 * geometry, so the skeleton stays useful at narrow widths too.
 */
export function MatchesTableSkeleton({
  rows = 5,
  className,
}: MatchesTableSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Desktop — table-shaped skeleton */}
      <div className="glass-card hidden overflow-hidden sm:block">
        <div className="border-b border-[var(--glass-border)] px-6 py-3">
          <div className="grid grid-cols-[180px_1fr_40px_1fr_180px_200px_140px] items-center gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`th-${i}`}
                className="h-3 rounded-full bg-[var(--glass-bg-strong)] animate-pulse"
                style={{ width: `${[60, 120, 20, 120, 90, 100, 70][i]}%` }}
              />
            ))}
          </div>
        </div>

        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={`row-${i}`}
            className={cn(
              "grid grid-cols-[180px_1fr_40px_1fr_180px_200px_140px] items-center gap-3 px-6 py-4",
              "border-b border-[var(--glass-border)] last:border-b-0",
              "animate-pulse",
            )}
          >
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded-full bg-[var(--glass-bg-strong)]" />
              <div className="h-2.5 w-16 rounded-full bg-[var(--glass-bg-strong)]" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-[var(--glass-bg-strong)]" />
              <div className="h-3 flex-1 max-w-[120px] rounded-full bg-[var(--glass-bg-strong)]" />
            </div>
            <div className="h-3 rounded-full bg-[var(--glass-bg-strong)]" />
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-[var(--glass-bg-strong)]" />
              <div className="h-3 flex-1 max-w-[120px] rounded-full bg-[var(--glass-bg-strong)]" />
            </div>
            <div className="h-3 w-24 rounded-full bg-[var(--glass-bg-strong)]" />
            <div className="h-6 w-32 rounded-full bg-[var(--glass-bg-strong)]" />
            <div className="ml-auto h-6 w-20 rounded-full bg-[var(--glass-bg-strong)]" />
          </div>
        ))}
      </div>

      {/* Mobile — strip-shaped skeleton */}
      <div className="flex flex-col gap-3 sm:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={`m-${i}`}
            className={cn(
              "rounded-[var(--radius-md)] border p-4",
              "border-[var(--glass-border)] bg-[var(--glass-bg)]",
              "animate-pulse",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2">
                <div className="size-5 rounded-full bg-[var(--glass-bg-strong)]" />
                <div className="h-3 flex-1 rounded-full bg-[var(--glass-bg-strong)]" />
              </div>
              <div className="h-2.5 w-6 rounded-full bg-[var(--glass-bg-strong)]" />
              <div className="flex flex-1 items-center justify-end gap-2">
                <div className="h-3 flex-1 rounded-full bg-[var(--glass-bg-strong)]" />
                <div className="size-5 rounded-full bg-[var(--glass-bg-strong)]" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="h-2.5 w-24 rounded-full bg-[var(--glass-bg-strong)]" />
              <div className="h-5 w-28 rounded-full bg-[var(--glass-bg-strong)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
