import { cn } from "@/lib/utils";

/**
 * Generic skeleton placeholders shared across the dashboard widgets.
 *
 * They match the visual rhythm of the real cards (glass surface,
 * rounded corners, header strip) so the layout doesn't pop when the
 * data resolves — only the content fades in.
 *
 * The pulse uses Tailwind's built-in `animate-pulse`, which is
 * neutralised by the global `prefers-reduced-motion` guard in
 * `globals.css`, so we don't need an explicit short-circuit here.
 */
export function WidgetSkeleton({
  className,
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div
      className={cn(
        "glass-card relative flex h-full flex-col gap-5 overflow-hidden p-6 sm:p-7",
        className,
      )}
      aria-hidden
    >
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-7 w-3/5 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]",
              i === 0 && "w-full",
              i === 1 && "w-11/12",
              i === 2 && "w-3/4",
              i > 2 && "w-2/3",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Hero skeleton with a left-aligned avatar block + greeting bars. */
export function DashboardHeroSkeleton() {
  return (
    <div
      className="glass-card relative flex items-center gap-5 overflow-hidden p-6 sm:p-8"
      aria-hidden
    >
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-[var(--glass-bg-hover)] sm:h-20 sm:w-20" />
      <div className="flex-1 space-y-3">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-9 w-3/4 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
    </div>
  );
}
