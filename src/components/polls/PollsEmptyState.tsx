import { Vote } from "lucide-react";
import { cn } from "@/lib/utils";

interface PollsEmptyStateProps {
  /** Toggle copy for active vs resolved sections. */
  variant: "active" | "resolved";
  className?: string;
}

const COPY: Record<
  PollsEmptyStateProps["variant"],
  { title: string; body: string }
> = {
  active: {
    title: "Jelenleg nincs aktív szavazás",
    body: "Új szavazás indul minden meccshét előtt. Iratkozz fel a Forca értesítésekre, hogy ne maradj le.",
  },
  resolved: {
    title: "Még nincs lezárt szavazás",
    body: "Amint az első szavazás eredményhirdetése megtörténik, itt böngészheted a részletes statisztikákat.",
  },
};

export function PollsEmptyState({ variant, className }: PollsEmptyStateProps) {
  const copy = COPY[variant];
  return (
    <div
      className={cn(
        "glass-card flex flex-col items-center gap-4 px-6 py-12 text-center",
        "border-dashed",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        )}
      >
        <Vote size={22} className="text-[var(--text-muted)]" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h3 className="font-display text-lg uppercase tracking-[0.18em] text-[var(--text-primary)]">
          {copy.title}
        </h3>
        <p className="mx-auto max-w-md text-sm text-[var(--text-secondary)]">
          {copy.body}
        </p>
      </div>
    </div>
  );
}

/** Card-shaped skeleton — matches the rough silhouette of a poll card. */
export function PollCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass-card relative flex flex-col gap-5 overflow-hidden p-5 sm:p-7",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="ml-auto h-3 w-20 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--glass-bg-hover)]" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-[var(--glass-bg-hover)]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-11 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--glass-bg-hover)]"
          />
        ))}
      </div>
    </div>
  );
}
