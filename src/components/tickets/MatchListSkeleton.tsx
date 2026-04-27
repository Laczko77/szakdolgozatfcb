"use client";

import { cn } from "@/lib/utils";

interface MatchListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Six-up skeleton placeholder for the match listing. Mirrors the
 * `MatchCard` outer shape (status pill, two title rows, footer) so the
 * layout doesn't shift when real data lands.
 */
export function MatchListSkeleton({
  count = 6,
  className,
}: MatchListSkeletonProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5",
        "lg:grid-cols-3 lg:gap-6",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "glass-card relative overflow-hidden p-6 sm:p-7",
            "animate-pulse",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-32 rounded-full bg-[var(--glass-bg-strong)]" />
            <div className="h-3 w-24 rounded-full bg-[var(--glass-bg-strong)]" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-7 w-3/4 rounded bg-[var(--glass-bg-strong)]" />
            <div className="h-3 w-8 rounded bg-[var(--glass-bg-strong)]" />
            <div className="h-7 w-2/3 rounded bg-[var(--glass-bg-strong)]" />
          </div>
          <div className="mt-7 flex items-center justify-between">
            <div className="h-3 w-32 rounded bg-[var(--glass-bg-strong)]" />
            <div className="h-3 w-16 rounded bg-[var(--glass-bg-strong)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
