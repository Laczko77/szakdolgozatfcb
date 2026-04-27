"use client";

import { cn } from "@/lib/utils";

/**
 * Loading placeholder shaped like a PlayerCard. Pulses the same glass
 * background you would see in the loaded state so there is no jarring
 * colour shift when the real cards swap in.
 */
export function PlayerCardSkeleton() {
  return (
    <li
      className={cn(
        "list-none aspect-[3/4] w-full overflow-hidden rounded-2xl",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "animate-pulse",
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--glass-bg-hover)] via-transparent to-[var(--glass-bg-hover)]" />
    </li>
  );
}

/** Renders `count` skeletons in the same grid shape as the live list. */
export function PlayerGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <PlayerCardSkeleton key={i} />
      ))}
    </ul>
  );
}
